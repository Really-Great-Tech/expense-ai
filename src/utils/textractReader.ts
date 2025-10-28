import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand, Block, Relationship, FeatureType } from '@aws-sdk/client-textract';
import { DocumentReader, TextractConfig, ApiResponse } from './types';

export interface TextractApiServiceOptions {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  uploadPath?: string;
}

/**
 * AWS Textract service for document text extraction
 */
export class TextractApiService implements DocumentReader {
  private textractClient: TextractClient;
  private parseCache = new Map<string, { result: Promise<ApiResponse<string>>; timestamp: number }>();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes cache

  private readonly uploadPath: string;
  private readonly logger = new Logger(TextractApiService.name);

  constructor(options: TextractApiServiceOptions = {}) {
    const awsRegion = options.region || 'us-east-1';
    this.uploadPath = options.uploadPath || './uploads';
    this.logger.log(`🌍 Initializing Textract client for region: ${awsRegion}`);

    const credentials =
      options.accessKeyId && options.secretAccessKey
        ? {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          }
        : undefined; // Use default credential chain if not provided

    // Initialize Textract client
    this.textractClient = new TextractClient({
      region: awsRegion,
      credentials,
    });
  }

  /**
   * Validate and sanitize file path for security
   */
  private validateFilePath(filePath: string): { isValid: boolean; error?: string; sanitizedPath?: string } {
    try {
      // Check for null, undefined, or empty paths
      if (!filePath || typeof filePath !== 'string') {
        return { isValid: false, error: 'Invalid file path: path must be a non-empty string' };
      }

      // Remove any null bytes (potential security issue)
      if (filePath.includes('\0')) {
        return { isValid: false, error: 'Invalid file path: contains null bytes' };
      }

      // Resolve to absolute path and normalize
      const resolvedPath = path.resolve(filePath);
      const normalizedPath = path.normalize(resolvedPath);

      // Check for path traversal attempts
      if (normalizedPath !== resolvedPath) {
        return { isValid: false, error: 'Invalid file path: path traversal detected' };
      }

      // Check if path contains dangerous characters or patterns
      const dangerousPatterns = [
        /\.\./,           // Parent directory traversal
        /[<>:"|?*]/,      // Windows invalid characters
        /[\x00-\x1f]/,    // Control characters
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(filePath)) {
          return { isValid: false, error: 'Invalid file path: contains dangerous characters' };
        }
      }

      // Define allowed directories (adjust based on your application needs)
      const allowedDirectories = [
        path.resolve('./uploads'),
        path.resolve('./temp'),
        path.resolve('./documents'),
        path.resolve(this.uploadPath),
      ];

      // Check if the file is within allowed directories
      const isWithinAllowedDir = allowedDirectories.some(allowedDir => {
        try {
          const relativePath = path.relative(allowedDir, normalizedPath);
          return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
        } catch {
          return false;
        }
      });

      if (!isWithinAllowedDir) {
        return { 
          isValid: false, 
          error: `File path not within allowed directories. Allowed: ${allowedDirectories.join(', ')}` 
        };
      }

      // Check file extension is allowed
      const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
      const fileExtension = path.extname(normalizedPath).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        return { 
          isValid: false, 
          error: `Unsupported file extension: ${fileExtension}. Allowed: ${allowedExtensions.join(', ')}` 
        };
      }

      return { isValid: true, sanitizedPath: normalizedPath };

    } catch (error) {
      return { 
        isValid: false, 
        error: `Path validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Parse document using AWS Textract
   */
  async parseDocument(filePath: string, config: TextractConfig = {}): Promise<ApiResponse<string>> {
    // Validate file path for security
    const pathValidation = this.validateFilePath(filePath);
    if (!pathValidation.isValid) {
      this.logger.error(`🚫 Security: ${pathValidation.error}`);
      return {
        success: false,
        error: `Security validation failed: ${pathValidation.error}`,
      };
    }

    // Use sanitized path for all operations
    const sanitizedPath = pathValidation.sanitizedPath!;
    
    // Create cache key based on sanitized file path and config
    const cacheKey = `${sanitizedPath}_${JSON.stringify(config)}`;
    const now = Date.now();

    // Clean expired cache entries
    for (const [key, entry] of this.parseCache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.parseCache.delete(key);
      }
    }

    // Check if we have a cached result for this file
    const cachedEntry = this.parseCache.get(cacheKey);
    if (cachedEntry) {
      this.logger.log(`Using cached result for document: ${sanitizedPath}`);
      return await cachedEntry.result;
    }

    // Create the parsing promise using sanitized path
    const parsePromise = this.performTextractParsing(sanitizedPath, config);

    // Cache the promise immediately to prevent duplicate calls
    this.parseCache.set(cacheKey, {
      result: parsePromise,
      timestamp: now,
    });

    return await parsePromise;
  }

  /**
   * Perform the actual document parsing using Textract
   */
  private async performTextractParsing(filePath: string, config: TextractConfig): Promise<ApiResponse<string>> {
    try {
      // Re-validate file path for additional security
      const pathValidation = this.validateFilePath(filePath);
      if (!pathValidation.isValid) {
        this.logger.error(`🚫 Security: ${pathValidation.error}`);
        return {
          success: false,
          error: `Security validation failed: ${pathValidation.error}`,
        };
      }

      // Use only the sanitized path for all operations
      const sanitizedPath = pathValidation.sanitizedPath!;
      this.logger.log(`Parsing document with Textract: ${sanitizedPath}`);

      // Check if file exists using sanitized path
      if (!fs.existsSync(sanitizedPath)) {
        return {
          success: false,
          error: `File not found: ${sanitizedPath}`,
        };
      }

      // Read file and get diagnostic information using sanitized path
      const fileBuffer = fs.readFileSync(sanitizedPath);
      const fileStats = fs.statSync(sanitizedPath);

      // Log diagnostic information
      this.logger.log(`📄 File diagnostics for ${filePath}:`);
      this.logger.log(`   Size: ${fileStats.size} bytes (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);
      this.logger.log(`   Buffer length: ${fileBuffer.length}`);
      this.logger.log(`   File extension: ${filePath.split('.').pop()}`);

      // Check file size limits (Textract limit is 10MB for synchronous)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (fileStats.size > maxSizeBytes) {
        return {
          success: false,
          error: `File too large for Textract: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB (max: 10MB)`,
        };
      }

      // Detect file type by header
      const fileHeader = fileBuffer.slice(0, 8);
      const headerString = fileHeader.toString('binary');
      const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';

      let fileType = 'unknown';
      let isValidFormat = false;

      // Check for PDF
      if (headerString.startsWith('%PDF')) {
        fileType = 'pdf';
        isValidFormat = true;
        const pdfVersion = fileBuffer.slice(0, 8).toString();
        this.logger.log(`   File type: PDF`);
        this.logger.log(`   PDF version: ${pdfVersion}`);
      }
      // Check for PNG
      else if (fileHeader[0] === 0x89 && fileHeader[1] === 0x50 && fileHeader[2] === 0x4e && fileHeader[3] === 0x47) {
        fileType = 'png';
        isValidFormat = true;
        this.logger.log(`   File type: PNG image`);
      }
      // Check for JPEG
      else if (fileHeader[0] === 0xff && fileHeader[1] === 0xd8 && fileHeader[2] === 0xff) {
        fileType = 'jpeg';
        isValidFormat = true;
        this.logger.log(`   File type: JPEG image`);
      }
      // Check for TIFF
      else if (
        (fileHeader[0] === 0x49 && fileHeader[1] === 0x49 && fileHeader[2] === 0x2a && fileHeader[3] === 0x00) ||
        (fileHeader[0] === 0x4d && fileHeader[1] === 0x4d && fileHeader[2] === 0x00 && fileHeader[3] === 0x2a)
      ) {
        fileType = 'tiff';
        isValidFormat = true;
        this.logger.log(`   File type: TIFF image`);
      } else {
        this.logger.log(
          `   File type: Unknown (header: ${Array.from(fileHeader.slice(0, 4))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ')})`,
        );
      }

      if (!isValidFormat) {
        return {
          success: false,
          error: `Unsupported file format: Expected PDF, PNG, JPEG, or TIFF. Detected: ${fileType}`,
        };
      }

      // Estimate page count based on file type
      let estimatedPages = 1;
      let isMultiPage = false;

      if (fileType === 'pdf') {
        // For PDFs, estimate page count from content
        const content = fileBuffer.toString('binary');
        const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
        estimatedPages = pageMatches ? pageMatches.length : 1;
        isMultiPage = estimatedPages > 1;

        this.logger.log(`   Estimated pages: ${estimatedPages}`);

        if (estimatedPages > 100) {
          this.logger.log(`   ⚠️ High page count detected (${estimatedPages} pages)`);
        }
      } else {
        // Images are always single page
        this.logger.log(`   Pages: 1 (image file)`);
      }

      this.logger.log(`   Processing method: ${isMultiPage ? 'SPLIT (multi-page PDF)' : 'DIRECT (single-page)'}`);

      // Route to appropriate processing method
      if (isMultiPage) {
        return await this.processMultiPageDocumentBySplitting(fileBuffer, filePath, config, estimatedPages);
      } else {
        return await this.processSinglePageDocument(fileBuffer, config);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error parsing document with Textract: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Enhanced error reporting
      let errorMessage = 'Unknown error occurred';
      let errorCode = 'UNKNOWN';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Check for specific AWS Textract error types
        if (error.message.includes('unsupported document format')) {
          errorCode = 'UNSUPPORTED_FORMAT';
          this.logger.error(`🚫 UNSUPPORTED_FORMAT: The PDF format is not supported by Textract`);
          this.logger.error(`   Common causes:`);
          this.logger.error(`   - Encrypted or password-protected PDF`);
          this.logger.error(`   - Corrupted PDF file`);
          this.logger.error(`   - Non-standard PDF structure`);
          this.logger.error(`   - PDF version incompatibility`);
        } else if (error.message.includes('InvalidParameterException')) {
          errorCode = 'INVALID_PARAMETER';
          this.logger.error(`🚫 INVALID_PARAMETER: Invalid request parameters`);
        } else if (error.message.includes('ProvisionedThroughputExceededException')) {
          errorCode = 'THROTTLED';
          this.logger.error(`🚫 THROTTLED: Textract rate limit exceeded`);
        } else if (error.message.includes('InternalServerError')) {
          errorCode = 'INTERNAL_ERROR';
          this.logger.error(`🚫 INTERNAL_ERROR: AWS Textract internal error`);
        }
      }

      return {
        success: false,
        error: `${errorCode}: ${errorMessage}`,
      };
    }
  }

  /**
   * Process single-page documents using synchronous APIs
   */
  private async processSinglePageDocument(fileBuffer: Buffer, config: TextractConfig): Promise<ApiResponse<string>> {
    try {
      // Determine which Textract API to use based on config
      const featureTypes = config.featureTypes || [];
      let blocks: Block[] = [];

      this.logger.log(`   Using Textract API: ${featureTypes.length > 0 ? 'AnalyzeDocument' : 'DetectDocumentText'}`);
      this.logger.log(`   Feature types: ${featureTypes.join(', ') || 'none'}`);

      if (featureTypes.length > 0) {
        // Use AnalyzeDocument for advanced features (tables, forms, etc.)
        const analyzeCommand = new AnalyzeDocumentCommand({
          Document: {
            Bytes: fileBuffer,
          },
          FeatureTypes: featureTypes as FeatureType[],
        });

        this.logger.log(`   Sending AnalyzeDocument request to Textract...`);
        const analyzeResponse = await this.textractClient.send(analyzeCommand);
        blocks = analyzeResponse.Blocks || [];
        this.logger.log(`   ✅ AnalyzeDocument successful, received ${blocks.length} blocks`);
      } else {
        // Use DetectDocumentText for simple text extraction
        const detectCommand = new DetectDocumentTextCommand({
          Document: {
            Bytes: fileBuffer,
          },
        });

        this.logger.log(`   Sending DetectDocumentText request to Textract...`);
        const detectResponse = await this.textractClient.send(detectCommand);
        blocks = detectResponse.Blocks || [];
        this.logger.log(`   ✅ DetectDocumentText successful, received ${blocks.length} blocks`);
      }

      // Convert blocks to markdown
      const markdownContent = this.convertBlocksToMarkdown(blocks);

      this.logger.log(`Single-page document parsed successfully. Content length: ${markdownContent.length} characters`);

      return {
        success: true,
        data: markdownContent,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error in single-page processing: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw to be handled by main error handler
    }
  }

  /**
   * Process multi-page documents by splitting into individual pages
   */
  private async processMultiPageDocumentBySplitting(
    fileBuffer: Buffer,
    filePath: string,
    config: TextractConfig,
    pageCount: number,
  ): Promise<ApiResponse<string>> {
    try {
      this.logger.log(`   📄 Processing ${pageCount}-page document by splitting into individual pages`);

      // Step 1: Split PDF into individual pages
      const pageBuffers = await this.splitPdfIntoPages(fileBuffer);
      this.logger.log(`   ✂️ PDF split into ${pageBuffers.length} pages`);

      // Step 2: Process each page individually
      const pageResults: string[] = [];

      for (let i = 0; i < pageBuffers.length; i++) {
        this.logger.log(`   📄 Processing page ${i + 1}/${pageBuffers.length}...`);

        try {
          const pageResult = await this.processSinglePageDocument(pageBuffers[i], config);

          if (pageResult.success && pageResult.data) {
            pageResults.push(`\n## Page ${i + 1}\n\n${pageResult.data}`);
            this.logger.log(`   ✅ Page ${i + 1} processed successfully (${pageResult.data.length} chars)`);
          } else {
            const errorMsg = 'error' in pageResult ? pageResult.error : 'Unknown error';
            this.logger.log(`   ⚠️ Page ${i + 1} failed: ${errorMsg}`);
            pageResults.push(`\n## Page ${i + 1}\n\n*[Page processing failed: ${errorMsg}]*`);
          }
        } catch (pageError) {
          this.logger.log(`   ❌ Page ${i + 1} error: ${pageError.message}`);
          pageResults.push(`\n## Page ${i + 1}\n\n*[Page processing error: ${pageError.message}]*`);
        }
      }

      // Step 3: Combine all page results
      const combinedContent = pageResults.join('\n');

      this.logger.log(`Multi-page document processed successfully. Total content length: ${combinedContent.length} characters`);

      return {
        success: true,
        data: combinedContent,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error in multi-page splitting processing: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw to be handled by main error handler
    }
  }

  /**
   * Split PDF into individual page buffers using pdf-lib
   */
  private async splitPdfIntoPages(pdfBuffer: Buffer): Promise<Buffer[]> {
    try {
      // Import pdf-lib dynamically
      const { PDFDocument } = await import('pdf-lib');

      this.logger.log(`   📄 Loading PDF for splitting...`);

      // Load the PDF document
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pageCount = pdfDoc.getPageCount();

      this.logger.log(`   📄 Splitting PDF with ${pageCount} pages`);

      const pageBuffers: Buffer[] = [];

      for (let i = 0; i < pageCount; i++) {
        this.logger.log(`   ✂️ Extracting page ${i + 1}/${pageCount}...`);

        // Create new PDF with single page
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);

        // Convert to buffer
        const pdfBytes = await newPdf.save();
        pageBuffers.push(Buffer.from(pdfBytes));
      }

      this.logger.log(`   ✂️ Successfully split into ${pageBuffers.length} individual pages`);
      return pageBuffers;
    } catch (error) {
      this.logger.error(
        `   ❌ Error splitting PDF: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
  }

  /**
   * Convert Textract blocks to markdown format
   */
  private convertBlocksToMarkdown(blocks: Block[]): string {
    const lines: string[] = [];
    const tables: Map<string, Block[]> = new Map();

    // Group blocks by type
    const lineBlocks = blocks.filter((block) => block.BlockType === 'LINE');
    const tableBlocks = blocks.filter((block) => block.BlockType === 'TABLE');
    const cellBlocks = blocks.filter((block) => block.BlockType === 'CELL');

    // Process line blocks first (regular text)
    lineBlocks.forEach((block) => {
      if (block.Text) {
        lines.push(block.Text);
      }
    });

    // Process tables
    tableBlocks.forEach((table) => {
      if (table.Id) {
        const tableCells = this.getTableCells(table, cellBlocks, blocks);
        const tableMarkdown = this.convertTableToMarkdown(tableCells);
        if (tableMarkdown) {
          lines.push('');
          lines.push(tableMarkdown);
          lines.push('');
        }
      }
    });

    return lines.join('\n');
  }

  /**
   * Get table cells for a specific table
   */
  private getTableCells(table: Block, cellBlocks: Block[], allBlocks: Block[]): Block[][] {
    const cells: Block[][] = [];

    if (!table.Relationships) return cells;

    // Find cells related to this table
    const tableCellIds = table.Relationships.filter((rel) => rel.Type === 'CHILD').flatMap((rel) => rel.Ids || []);

    const tableCells = cellBlocks.filter((cell) => tableCellIds.includes(cell.Id || ''));

    // Group cells by row and column
    const cellMap = new Map<string, Block>();
    tableCells.forEach((cell) => {
      if (cell.RowIndex !== undefined && cell.ColumnIndex !== undefined) {
        const key = `${cell.RowIndex}-${cell.ColumnIndex}`;
        cellMap.set(key, cell);
      }
    });

    // Convert to 2D array
    const maxRow = Math.max(...tableCells.map((cell) => cell.RowIndex || 0));
    const maxCol = Math.max(...tableCells.map((cell) => cell.ColumnIndex || 0));

    for (let row = 1; row <= maxRow; row++) {
      const rowCells: Block[] = [];
      for (let col = 1; col <= maxCol; col++) {
        const cell = cellMap.get(`${row}-${col}`);
        if (cell) {
          rowCells.push(cell);
        }
      }
      if (rowCells.length > 0) {
        cells.push(rowCells);
      }
    }

    return cells;
  }

  /**
   * Convert table cells to markdown table format
   */
  private convertTableToMarkdown(cells: Block[][]): string {
    if (cells.length === 0) return '';

    const rows: string[] = [];

    cells.forEach((row, rowIndex) => {
      const cellTexts = row.map((cell) => {
        // Get text from cell relationships
        const cellText = this.getCellText(cell);
        return cellText.replace(/\|/g, '\\|'); // Escape pipe characters
      });

      rows.push(`| ${cellTexts.join(' | ')} |`);

      // Add header separator after first row
      if (rowIndex === 0) {
        const separator = cellTexts.map(() => '---').join(' | ');
        rows.push(`| ${separator} |`);
      }
    });

    return rows.join('\n');
  }

  /**
   * Extract text content from a cell block
   */
  private getCellText(cell: Block): string {
    if (cell.Text) {
      return cell.Text;
    }

    // If no direct text, try to get from relationships
    if (cell.Relationships) {
      const childTexts: string[] = [];
      cell.Relationships.forEach((rel) => {
        if (rel.Type === 'CHILD' && rel.Ids) {
          // In a real implementation, you'd need to look up these IDs in the blocks array
          // For now, we'll return empty string
        }
      });
      return childTexts.join(' ');
    }

    return '';
  }
}

// Factory function for easy instantiation
export function createTextractService(accessKeyId?: string, secretAccessKey?: string, region?: string, uploadPath?: string): TextractApiService {
  return new TextractApiService({ accessKeyId, secretAccessKey, region, uploadPath });
}
