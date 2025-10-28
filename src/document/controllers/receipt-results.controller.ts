import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ReceiptResultsQueryService } from '../services/receipt-results-query.service';
import { ProcessingStatus } from '../entities/receipt-processing-result.entity';

@Controller('api/v1/receipts')
export class ReceiptResultsController {
  private readonly logger = new Logger(ReceiptResultsController.name);

  constructor(private receiptResultsQuery: ReceiptResultsQueryService) {}

  /**
   * Get complete processing results for a specific receipt
   * GET /api/v1/receipts/:receiptId/results
   */
  @Get(':receiptId/results')
  async getResults(@Param('receiptId') receiptId: string) {
    this.logger.log(`Fetching results for receipt ${receiptId}`);

    try {
      return await this.receiptResultsQuery.getReceiptResults(receiptId);
    } catch (error) {
      this.logger.error(`Failed to fetch results for receipt ${receiptId}:`, error);
      throw error;
    }
  }

  /**
   * Get processing status for a specific receipt
   * GET /api/v1/receipts/:receiptId/status
   */
  @Get(':receiptId/status')
  async getStatus(@Param('receiptId') receiptId: string) {
    this.logger.log(`Fetching status for receipt ${receiptId}`);

    try {
      return await this.receiptResultsQuery.getReceiptStatus(receiptId);
    } catch (error) {
      this.logger.error(`Failed to fetch status for receipt ${receiptId}:`, error);
      throw error;
    }
  }

  /**
   * Get all receipt processing results for a document
   * GET /api/v1/receipts/document/:documentId/results
   */
  @Get('document/:documentId/results')
  async getDocumentResults(@Param('documentId') documentId: string) {
    this.logger.log(`Fetching results for document ${documentId}`);

    try {
      return await this.receiptResultsQuery.getDocumentResults(documentId);
    } catch (error) {
      this.logger.error(`Failed to fetch results for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Search receipt processing results with filters
   * GET /api/v1/receipts/search?documentId=xxx&status=COMPLETED&limit=20&offset=0
   */
  @Get('search')
  async searchResults(
    @Query('documentId') documentId?: string,
    @Query('status') status?: ProcessingStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log('Searching receipt processing results', {
      documentId,
      status,
      limit,
      offset,
    });

    try {
      return await this.receiptResultsQuery.queryResults({
        documentId,
        status,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
      });
    } catch (error) {
      this.logger.error('Failed to search receipt results:', error);
      throw error;
    }
  }

  /**
   * Get processing metrics
   * GET /api/v1/receipts/metrics?documentId=xxx
   */
  @Get('metrics')
  async getMetrics(@Query('documentId') documentId?: string) {
    this.logger.log(`Fetching processing metrics`, { documentId });

    try {
      return await this.receiptResultsQuery.getProcessingMetrics(documentId);
    } catch (error) {
      this.logger.error('Failed to fetch processing metrics:', error);
      throw error;
    }
  }

  /**
   * Get compliance-focused results for a specific receipt
   * Returns filtered data with classification, extraction, and compliance issues
   * Merges image quality issues into the compliance issues list for unified display
   * GET /api/v1/receipts/:receiptId/compliance
   */
  @Get(':receiptId/compliance')
  async getComplianceResults(@Param('receiptId') receiptId: string) {
    this.logger.log(`Fetching compliance results for receipt ${receiptId}`);

    try {
      return await this.receiptResultsQuery.getReceiptComplianceResults(receiptId);
    } catch (error) {
      this.logger.error(`Failed to fetch compliance results for receipt ${receiptId}:`, error);
      throw error;
    }
  }
}
