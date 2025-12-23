import * as path from 'path';
import { Logger } from '@nestjs/common';
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand, Block, FeatureType } from '@aws-sdk/client-textract';
import { BrokenCircuitError } from 'cockatiel';
import { DocumentReader, TextractConfig, ApiResponse } from '../../utils/types';
import { getGlobalCircuitBreakerService } from '../../resilience';

export interface TextractApiServiceOptions {
  region?: string;
}

/**
 * AWS Textract service for document text extraction
 */
export class TextractApiService implements DocumentReader {
  private textractClient: TextractClient;
  private readonly logger = new Logger(TextractApiService.name);

  constructor(options: TextractApiServiceOptions = {}) {
    const awsRegion = options.region || 'eu-west-1';
    this.logger.log(` Initializing Textract client for region: ${awsRegion}`);

    // Initialize Textract client - uses AWS SDK default credential chain:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Shared credentials file (~/.aws/credentials)
    // 3. ECS Container credentials (Task Role)
    // 4. EC2 Instance metadata (Instance Profile)
    this.textractClient = new TextractClient({
      region: awsRegion,
      maxAttempts: 4,
      retryMode: 'adaptive',
    });
  }

  /**
   * Parse document from buffer using AWS Textract
   */
  async parseDocumentFromBuffer(buffer: Buffer, fileName: string, config: TextractConfig = {}): Promise<ApiResponse<string>> {
    try {
      const fileExtension = path.extname(fileName).toLowerCase();
      this.logger.log(`Parsing document from buffer: ${fileName} (${buffer.length} bytes)`);

      // Check file size limits (Textract limit is 10MB for synchronous)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (buffer.length > maxSizeBytes) {
        return {
          success: false,
          error: `File too large for Textract: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: 10MB)`,
        };
      }

      // Detect file type and validate format
      const fileHeader = buffer.slice(0, 8);
      const headerString = fileHeader.toString('binary');

      let fileType = 'unknown';
      let isValidFormat = false;
      let isMultiPage = false;
      let estimatedPages = 1;

      // Check for PDF
      if (headerString.startsWith('%PDF')) {
        fileType = 'pdf';
        isValidFormat = true;
        const content = buffer.toString('binary');
        const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
        estimatedPages = pageMatches ? pageMatches.length : 1;
        isMultiPage = estimatedPages > 1;
        this.logger.log(`   File type: PDF (${estimatedPages} pages)`);
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
      }

      if (!isValidFormat) {
        return {
          success: false,
          error: `Unsupported file format: Expected PDF, PNG, JPEG, or TIFF. Detected: ${fileType}`,
        };
      }

      // Route to appropriate processing method
      if (isMultiPage) {
        return await this.processMultiPageDocumentBySplitting(buffer, fileName, config, estimatedPages);
      } else {
        return await this.processSinglePageDocument(buffer, config);
      }
    } catch (error) {
      this.logger.error(
        ` Error parsing document from buffer: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: `Buffer parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Process single-page documents using synchronous APIs
   * Wrapped with circuit breaker to prevent cascading failures
   */
  private async processSinglePageDocument(fileBuffer: Buffer, config: TextractConfig): Promise<ApiResponse<string>> {
    const circuitBreaker = getGlobalCircuitBreakerService().getTextractBreaker();

    try {
      return await circuitBreaker.execute(async () => {
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

          this.logger.log('   Sending AnalyzeDocument request to Textract...');
          const analyzeResponse = await this.textractClient.send(analyzeCommand);
          blocks = analyzeResponse.Blocks || [];
          this.logger.log(`    AnalyzeDocument successful, received ${blocks.length} blocks`);
        } else {
          // Use DetectDocumentText for simple text extraction
          const detectCommand = new DetectDocumentTextCommand({
            Document: {
              Bytes: fileBuffer,
            },
          });

          this.logger.log('   Sending DetectDocumentText request to Textract...');
          const detectResponse = await this.textractClient.send(detectCommand);
          blocks = detectResponse.Blocks || [];
          this.logger.log(`    DetectDocumentText successful, received ${blocks.length} blocks`);
        }

        // Convert blocks to markdown
        const markdownContent = this.convertBlocksToMarkdown(blocks);

        this.logger.log(`Single-page document parsed successfully. Content length: ${markdownContent.length} characters`);

        return {
          success: true,
          data: markdownContent,
        };
      });
    } catch (error) {
      if (error instanceof BrokenCircuitError) {
        this.logger.error('Textract service temporarily unavailable (circuit breaker open)');
        return {
          success: false,
          error: 'Textract service temporarily unavailable (circuit breaker open)',
        };
      }

      this.logger.error(
        ` Error in single-page processing: ${error instanceof Error ? error.message : error}`,
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
      this.logger.log(`    Processing ${pageCount}-page document by splitting into individual pages`);

      // Step 1: Split PDF into individual pages
      const pageBuffers = await this.splitPdfIntoPages(fileBuffer);
      this.logger.log(`   PDF split into ${pageBuffers.length} pages`);

      // Step 2: Process each page individually
      const pageResults: string[] = [];

      for (let i = 0; i < pageBuffers.length; i++) {
        this.logger.log(`    Processing page ${i + 1}/${pageBuffers.length}...`);

        try {
          const pageResult = await this.processSinglePageDocument(pageBuffers[i], config);

          if (pageResult.success && pageResult.data) {
            pageResults.push(`\n## Page ${i + 1}\n\n${pageResult.data}`);
            this.logger.log(`    Page ${i + 1} processed successfully (${pageResult.data.length} chars)`);
          } else {
            const errorMsg = 'error' in pageResult ? pageResult.error : 'Unknown error';
            this.logger.log(`   Page ${i + 1} failed: ${errorMsg}`);
            pageResults.push(`\n## Page ${i + 1}\n\n*[Page processing failed: ${errorMsg}]*`);
          }
        } catch (pageError) {
          this.logger.log(`    Page ${i + 1} error: ${pageError.message}`);
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
        ` Error in multi-page splitting processing: ${error instanceof Error ? error.message : error}`,
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

      this.logger.log(`    Loading PDF for splitting...`);

      // Load the PDF document with compatibility options
      const pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
      const pageCount = pdfDoc.getPageCount();

      this.logger.log(`    Splitting PDF with ${pageCount} pages`);

      const pageBuffers: Buffer[] = [];

      for (let i = 0; i < pageCount; i++) {
        this.logger.log(`   Extracting page ${i + 1}/${pageCount}...`);

        // Create new PDF with single page
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);

        // Convert to buffer with Textract-compatible options
        // useObjectStreams: false creates PDF 1.4 structure (better Textract compatibility)
        const pdfBytes = await newPdf.save({
          useObjectStreams: false,
          addDefaultPage: false,
        });
        pageBuffers.push(Buffer.from(pdfBytes));
      }

      this.logger.log(`   Successfully split into ${pageBuffers.length} individual pages`);
      return pageBuffers;
    } catch (error) {
      this.logger.error(
        `    Error splitting PDF: ${error instanceof Error ? error.message : error}`,
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
// Uses AWS SDK default credential chain (env vars, shared credentials, IAM roles)
export function createTextractService(region?: string, uploadPath?: string): TextractApiService {
  return new TextractApiService({ region, uploadPath });
}
