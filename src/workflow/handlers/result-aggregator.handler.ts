import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpenseStatusService, DocumentResultsResponse } from '@/expense-result/services/expense-status.service';
import { DocumentPersistenceService } from '@/expense-document/services/document-persistence.service';

/**
 * ResultAggregatorHandler
 *
 * Called when all child PROCESS_RECEIPT jobs complete.
 * Uses ExpenseStatusService.getDocumentResults() for aggregation.
 * Optionally sends webhook notification.
 */
@Injectable()
export class ResultAggregatorHandler {
  private readonly logger = new Logger(ResultAggregatorHandler.name);
  private readonly webhookUrl?: string;

  constructor(
    private readonly expenseStatusService: ExpenseStatusService,
    private readonly documentPersistenceService: DocumentPersistenceService,
    private readonly configService: ConfigService,
  ) {
    this.webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    if (this.webhookUrl) {
      this.logger.log(`Webhook URL configured: ${this.webhookUrl}`);
    }
  }

  async handle(data: { documentId: string }): Promise<DocumentResultsResponse> {
    const { documentId } = data;
    const startTime = Date.now();

    this.logger.log(`Aggregating results for document: ${documentId}`);

    try {
      // Use existing ExpenseStatusService for aggregation
      const results = await this.expenseStatusService.getDocumentResults(documentId);

      const processingTime = Date.now() - startTime;
      this.logger.log(`Results aggregated for document ${documentId} in ${processingTime}ms`, {
        overallStatus: results.overallStatus,
        stats: results.stats,
      });

      // Send webhook notification if configured
      if (this.webhookUrl) {
        await this.sendWebhook(results);
      }

      return results;
    } catch (error: any) {
      this.logger.error(`Failed to aggregate results for document ${documentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send webhook notification with processing results
   */
  private async sendWebhook(results: DocumentResultsResponse): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      this.logger.log(`Sending webhook notification for document ${results.document.id}`);

      const webhookPayload = {
        eventType: 'expense.processing.completed',
        timestamp: new Date().toISOString(),
        data: {
          documentId: results.document.id,
          originalFileName: results.document.originalFileName,
          overallStatus: results.overallStatus,
          stats: results.stats,
          overallProgress: results.overallProgress,
          receipts: results.receipts.map((receipt) => ({
            receiptId: receipt.receiptId,
            fileName: receipt.fileName,
            status: receipt.status,
            processingStatus: receipt.processingStatus,
            hasResults: receipt.hasResults,
            hasErrors: receipt.hasErrors,
            pages: receipt.pages,
            receiptNumber: receipt.receiptNumber,
            // Include extracted data summary if available
            extractionSummary: receipt.results?.extraction ? {
              hasSupplier: !!receipt.results.extraction.supplier,
              hasAmount: !!receipt.results.extraction.transactionAmount,
              hasDate: !!receipt.results.extraction.transactionDate,
              issueCount: receipt.results.issues?.length || 0,
            } : null,
          })),
        },
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        this.logger.warn(`Webhook returned non-OK status: ${response.status} ${response.statusText}`);
      } else {
        this.logger.log(`Webhook notification sent successfully for document ${results.document.id}`);
      }
    } catch (error: any) {
      // Log but don't fail - webhook is non-critical
      this.logger.error(`Failed to send webhook: ${error.message}`);
    }
  }
}
