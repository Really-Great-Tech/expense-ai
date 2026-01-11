import { Injectable, Logger } from '@nestjs/common';
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  FeatureType,
  Block,
  GetDocumentAnalysisCommandOutput,
} from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { BrokenCircuitError } from 'cockatiel';
import { ServiceUnavailableError, RetryableBulkheadTimeoutError } from '@/common/errors/service-errors';
import { getGlobalBulkheadService } from '@/resilience/bulkhead.service';
import { getGlobalCircuitBreakerService } from '@/resilience/circuit-breaker.service';
import { ApiResponse } from '@/utils/types';

export interface AsyncTextractConfig {
  featureTypes?: ('TABLES' | 'FORMS' | 'SIGNATURES')[];
  outputFormat?: 'markdown' | 'json';
}

interface PollConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  maxWaitTimeMs: number;
  backoffMultiplier: number;
}

/**
 * Async Textract Service
 *
 * Uses AWS Textract async APIs (StartDocumentAnalysis + GetDocumentAnalysis)
 * for processing multi-page documents more efficiently.
 *
 * Benefits over sync API:
 * - Processes entire document in one job (up to 3000 pages)
 * - No PDF splitting needed
 * - Better rate limit handling (fewer API calls)
 * - ~2-3x faster for multi-page documents
 *
 * Requires document to be in S3 (async APIs don't accept raw bytes).
 */
@Injectable()
export class TextractAsyncService {
  private readonly logger = new Logger(TextractAsyncService.name);
  private readonly textractClient: TextractClient;
  private readonly s3Client: S3Client;
  private readonly bulkhead = getGlobalBulkheadService();
  private readonly circuitBreaker = getGlobalCircuitBreakerService();

  private readonly defaultPollConfig: PollConfig = {
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    maxWaitTimeMs: 300000, // 5 minutes
    backoffMultiplier: 1.5,
  };

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.textractClient = new TextractClient({ region });
    this.s3Client = new S3Client({ region });
  }

  /**
   * Parse document using async Textract API
   * Document must already be in S3
   *
   * @param s3Bucket - S3 bucket containing the document
   * @param s3Key - S3 key (path) to the document
   * @param config - Optional configuration for feature types and output format
   * @returns ApiResponse with markdown content
   */
  async parseDocumentAsync(
    s3Bucket: string,
    s3Key: string,
    config: AsyncTextractConfig = {},
  ): Promise<ApiResponse<string>> {
    const startTime = Date.now();

    try {
      this.logger.log(`Starting async Textract analysis for s3://${s3Bucket}/${s3Key}`);

      // Map feature types to AWS SDK enum
      const features: FeatureType[] = this.mapFeatureTypes(config.featureTypes);

      // Start the async analysis job through bulkhead + circuit breaker
      const jobId = await this.bulkhead.executeWithTimeout('textract', async () => {
        return await this.circuitBreaker.getTextractBreaker().execute(async () => {
          return await this.startAnalysisJob(s3Bucket, s3Key, features);
        });
      });

      this.logger.log(`Async Textract job started: ${jobId}`);

      // Poll for completion (polling doesn't go through bulkhead - it's just checking status)
      const result = await this.pollForCompletion(jobId);

      // Format result to markdown (same format as sync version)
      const blocks = result.Blocks || [];
      const markdown = this.formatToMarkdown(blocks);

      const duration = Date.now() - startTime;
      this.logger.log(`Async Textract completed in ${duration}ms, ${blocks.length} blocks, ${markdown.length} chars`);

      return {
        success: true,
        data: markdown,
      };
    } catch (error: any) {
      return this.handleError(error, s3Bucket, s3Key);
    }
  }

  /**
   * Upload buffer to S3 for async processing
   * Use when document is not already in S3
   *
   * @param buffer - Document buffer
   * @param fileName - Original file name
   * @returns S3 location { bucket, key }
   */
  async uploadForProcessing(
    buffer: Buffer,
    fileName: string,
  ): Promise<{ bucket: string; key: string }> {
    const bucket = process.env.TEXTRACT_TEMP_BUCKET || process.env.S3_BUCKET_NAME;
    if (!bucket) {
      throw new Error('No S3 bucket configured for Textract uploads (set TEXTRACT_TEMP_BUCKET or S3_BUCKET_NAME)');
    }

    const key = `textract-temp/${Date.now()}-${fileName}`;

    this.logger.log(`Uploading document to s3://${bucket}/${key} for async processing`);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: this.getContentType(fileName),
      }),
    );

    this.logger.log(`Document uploaded successfully to s3://${bucket}/${key}`);

    return { bucket, key };
  }

  /**
   * Start async document analysis job
   */
  private async startAnalysisJob(
    bucket: string,
    key: string,
    features: FeatureType[],
  ): Promise<string> {
    const command = new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
      FeatureTypes: features.length > 0 ? features : [FeatureType.TABLES, FeatureType.FORMS],
    });

    const response = await this.textractClient.send(command);

    if (!response.JobId) {
      throw new Error('Textract StartDocumentAnalysis did not return a JobId');
    }

    return response.JobId;
  }

  /**
   * Poll for job completion with exponential backoff
   */
  private async pollForCompletion(jobId: string): Promise<GetDocumentAnalysisCommandOutput> {
    const config = this.defaultPollConfig;
    const startTime = Date.now();
    let delay = config.initialDelayMs;
    let allBlocks: Block[] = [];
    let nextToken: string | undefined;

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= config.maxWaitTimeMs) {
        throw new ServiceUnavailableError(
          'Textract',
          new Error(`Async job timed out after ${elapsed}ms (limit: ${config.maxWaitTimeMs}ms)`),
          true,
        );
      }

      const command = new GetDocumentAnalysisCommand({
        JobId: jobId,
        NextToken: nextToken,
      });

      const response = await this.textractClient.send(command);

      switch (response.JobStatus) {
        case 'SUCCEEDED':
          // Collect blocks from this page
          if (response.Blocks) {
            allBlocks = allBlocks.concat(response.Blocks);
          }

          // Check for more pages of results
          if (response.NextToken) {
            nextToken = response.NextToken;
            // No delay needed, just fetch next page
            continue;
          }

          // All pages collected
          return { ...response, Blocks: allBlocks };

        case 'FAILED':
        case 'PARTIAL_SUCCESS':
          const errorMsg = response.StatusMessage || 'Unknown error';
          this.logger.error(`Textract async job failed: ${errorMsg}`);
          throw new Error(`Textract job failed: ${errorMsg}`);

        case 'IN_PROGRESS':
          // Wait and retry
          this.logger.debug(`Textract job ${jobId} in progress, waiting ${delay}ms...`);
          await this.sleep(delay);
          delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
          break;

        default:
          this.logger.warn(`Unknown job status: ${response.JobStatus}`);
          await this.sleep(delay);
          delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  /**
   * Convert Textract blocks to markdown format
   * Groups blocks by page number and formats each page with ## Page N header
   */
  private formatToMarkdown(blocks: Block[]): string {
    if (blocks.length === 0) {
      return '';
    }

    // Group blocks by page number
    const pageGroups = new Map<number, Block[]>();

    for (const block of blocks) {
      const pageNum = block.Page || 1;
      if (!pageGroups.has(pageNum)) {
        pageGroups.set(pageNum, []);
      }
      pageGroups.get(pageNum)!.push(block);
    }

    // Sort pages and format
    const sortedPages = [...pageGroups.entries()].sort((a, b) => a[0] - b[0]);
    const pageResults: string[] = [];

    for (const [pageNum, pageBlocks] of sortedPages) {
      const pageContent = this.formatPageBlocks(pageBlocks);
      pageResults.push(`\n## Page ${pageNum}\n\n${pageContent}`);
    }

    return pageResults.join('\n\n---\n');
  }

  /**
   * Format blocks for a single page
   */
  private formatPageBlocks(blocks: Block[]): string {
    const lines: string[] = [];

    // Separate block types
    const lineBlocks = blocks.filter((b) => b.BlockType === 'LINE');
    const tableBlocks = blocks.filter((b) => b.BlockType === 'TABLE');
    const cellBlocks = blocks.filter((b) => b.BlockType === 'CELL');
    const kvBlocks = blocks.filter((b) => b.BlockType === 'KEY_VALUE_SET');

    // Process line blocks (regular text)
    for (const block of lineBlocks) {
      if (block.Text) {
        lines.push(block.Text);
      }
    }

    // Process tables
    for (const table of tableBlocks) {
      if (table.Id) {
        const tableMarkdown = this.formatTable(table, cellBlocks, blocks);
        if (tableMarkdown) {
          lines.push('');
          lines.push(tableMarkdown);
          lines.push('');
        }
      }
    }

    // Process key-value pairs (forms)
    const kvPairs = this.extractKeyValuePairs(kvBlocks, blocks);
    if (kvPairs.length > 0) {
      lines.push('');
      lines.push('**Form Fields:**');
      for (const { key, value } of kvPairs) {
        lines.push(`- **${key}**: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a table to markdown
   */
  private formatTable(table: Block, cellBlocks: Block[], allBlocks: Block[]): string {
    if (!table.Relationships) return '';

    // Find cell IDs for this table
    const tableCellIds = table.Relationships
      .filter((rel) => rel.Type === 'CHILD')
      .flatMap((rel) => rel.Ids || []);

    // Get cells belonging to this table
    const tableCells = cellBlocks.filter((cell) => tableCellIds.includes(cell.Id || ''));

    if (tableCells.length === 0) return '';

    // Group cells by row and column
    const cellMap = new Map<string, Block>();
    let maxRow = 0;
    let maxCol = 0;

    for (const cell of tableCells) {
      if (cell.RowIndex !== undefined && cell.ColumnIndex !== undefined) {
        const key = `${cell.RowIndex}-${cell.ColumnIndex}`;
        cellMap.set(key, cell);
        maxRow = Math.max(maxRow, cell.RowIndex);
        maxCol = Math.max(maxCol, cell.ColumnIndex);
      }
    }

    // Build markdown table
    const rows: string[] = [];

    for (let row = 1; row <= maxRow; row++) {
      const cellTexts: string[] = [];
      for (let col = 1; col <= maxCol; col++) {
        const cell = cellMap.get(`${row}-${col}`);
        const text = cell ? this.getCellText(cell, allBlocks) : '';
        cellTexts.push(text.replace(/\|/g, '\\|')); // Escape pipes
      }
      rows.push(`| ${cellTexts.join(' | ')} |`);

      // Add header separator after first row
      if (row === 1) {
        const separator = cellTexts.map(() => '---').join(' | ');
        rows.push(`| ${separator} |`);
      }
    }

    return rows.join('\n');
  }

  /**
   * Get text content from a cell block
   */
  private getCellText(cell: Block, allBlocks: Block[]): string {
    if (cell.Text) {
      return cell.Text;
    }

    // Get text from child WORD blocks
    if (cell.Relationships) {
      const childIds = cell.Relationships
        .filter((rel) => rel.Type === 'CHILD')
        .flatMap((rel) => rel.Ids || []);

      const words = allBlocks
        .filter((b) => childIds.includes(b.Id || '') && b.BlockType === 'WORD')
        .map((b) => b.Text || '')
        .filter((t) => t);

      return words.join(' ');
    }

    return '';
  }

  /**
   * Extract key-value pairs from KEY_VALUE_SET blocks
   */
  private extractKeyValuePairs(
    kvBlocks: Block[],
    allBlocks: Block[],
  ): Array<{ key: string; value: string }> {
    const pairs: Array<{ key: string; value: string }> = [];

    // Find KEY blocks
    const keyBlocks = kvBlocks.filter(
      (b) => b.EntityTypes?.includes('KEY'),
    );

    for (const keyBlock of keyBlocks) {
      // Get key text
      const keyText = this.getBlockText(keyBlock, allBlocks);

      // Find associated value block
      const valueBlockId = keyBlock.Relationships
        ?.find((rel) => rel.Type === 'VALUE')
        ?.Ids?.[0];

      if (valueBlockId) {
        const valueBlock = allBlocks.find((b) => b.Id === valueBlockId);
        const valueText = valueBlock ? this.getBlockText(valueBlock, allBlocks) : '';

        if (keyText) {
          pairs.push({ key: keyText, value: valueText });
        }
      }
    }

    return pairs;
  }

  /**
   * Get text from a block and its children
   */
  private getBlockText(block: Block, allBlocks: Block[]): string {
    if (block.Text) {
      return block.Text;
    }

    if (block.Relationships) {
      const childIds = block.Relationships
        .filter((rel) => rel.Type === 'CHILD')
        .flatMap((rel) => rel.Ids || []);

      const words = allBlocks
        .filter((b) => childIds.includes(b.Id || '') && (b.BlockType === 'WORD' || b.BlockType === 'SELECTION_ELEMENT'))
        .map((b) => {
          if (b.BlockType === 'SELECTION_ELEMENT') {
            return b.SelectionStatus === 'SELECTED' ? '[X]' : '[ ]';
          }
          return b.Text || '';
        })
        .filter((t) => t);

      return words.join(' ');
    }

    return '';
  }

  /**
   * Map config feature types to AWS SDK enum
   */
  private mapFeatureTypes(types?: ('TABLES' | 'FORMS' | 'SIGNATURES')[]): FeatureType[] {
    if (!types || types.length === 0) {
      return [FeatureType.TABLES, FeatureType.FORMS];
    }

    return types.map((t) => {
      switch (t) {
        case 'TABLES':
          return FeatureType.TABLES;
        case 'FORMS':
          return FeatureType.FORMS;
        case 'SIGNATURES':
          return FeatureType.SIGNATURES;
        default:
          return FeatureType.TABLES;
      }
    });
  }

  /**
   * Handle errors and convert to appropriate error types
   */
  private handleError(error: any, bucket: string, key: string): ApiResponse<string> {
    // Handle bulkhead timeout - RETRYABLE
    if (error instanceof RetryableBulkheadTimeoutError) {
      this.logger.warn(`Textract async bulkhead timeout: ${error.message}`);
      throw new ServiceUnavailableError('Textract', error, true);
    }

    // Handle circuit breaker open - RETRYABLE
    if (error instanceof BrokenCircuitError) {
      this.logger.error('Textract service temporarily unavailable (circuit breaker open)');
      throw new ServiceUnavailableError('Textract', error, true);
    }

    // Handle AWS throttling - RETRYABLE
    if (error.name === 'ThrottlingException' || error.$metadata?.httpStatusCode === 429) {
      this.logger.warn(`Textract async throttled: ${error.message}`);
      throw new ServiceUnavailableError('Textract', error, true);
    }

    // Handle provisioned throughput exceeded - RETRYABLE
    if (error.name === 'ProvisionedThroughputExceededException') {
      this.logger.warn(`Textract throughput exceeded: ${error.message}`);
      throw new ServiceUnavailableError('Textract', error, true);
    }

    // Handle S3 object not found - NOT RETRYABLE
    if (error.name === 'InvalidS3ObjectException') {
      this.logger.error(`S3 object not found: s3://${bucket}/${key}`);
      return {
        success: false,
        error: `Document not found in S3: s3://${bucket}/${key}`,
      };
    }

    // Handle service unavailable - RETRYABLE
    if (error.$metadata?.httpStatusCode === 503 || error instanceof ServiceUnavailableError) {
      this.logger.error(`Textract service unavailable: ${error.message}`);
      throw new ServiceUnavailableError('Textract', error, true);
    }

    // Log and return error for other cases
    this.logger.error(`Textract async error: ${error.message}`, error.stack);
    return {
      success: false,
      error: `Textract async processing failed: ${error.message}`,
    };
  }

  /**
   * Get content type from filename
   */
  private getContentType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
