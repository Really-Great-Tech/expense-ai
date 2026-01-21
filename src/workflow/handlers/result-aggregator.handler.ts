import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ExpenseStatusService, DocumentResultsResponse } from '@/expense-result/services/expense-status.service';
import { DocumentPersistenceService } from '@/expense-document/services/document-persistence.service';
import { ProcessExpenseJobData } from '../interfaces/workflow-job-data.interface';

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

  async handle(job: Job<ProcessExpenseJobData>): Promise<DocumentResultsResponse> {
    const { documentId } = job.data;
    const startTime = Date.now();

    await job.updateProgress(0);
    await job.log(`Aggregating results for document: ${documentId}`);
    this.logger.log(`Aggregating results for document: ${documentId}`);

    try {
      // Get child job results for logging
      const childrenValues = await job.getChildrenValues();
      const childCount = Object.keys(childrenValues).length;
      await job.log(`Collected results from ${childCount} child receipt jobs`);
      await job.updateProgress(30);

      // Use existing ExpenseStatusService for aggregation
      const results = await this.expenseStatusService.getDocumentResults(documentId);
      await job.updateProgress(60);

      const processingTime = Date.now() - startTime;
      await job.log(`Results aggregated: ${results.stats.completed}/${results.stats.total} receipts processed`);
      this.logger.log(`Results aggregated for document ${documentId} in ${processingTime}ms`, {
        overallStatus: results.overallStatus,
        stats: results.stats,
      });

      // Send webhook notification if configured
      if (this.webhookUrl) {
        await job.log('Sending webhook notification...');
        await this.sendWebhook(results);
        await job.log('Webhook notification sent');
      }

      await job.updateProgress(100);
      await job.log(`Document processing completed in ${processingTime}ms`);

      // Note: Job cleanup is handled by TTL configuration in redis.config.ts
      // Successful jobs: 10 second TTL
      // Failed jobs: 24 hour TTL for debugging

      return results;
    } catch (error: any) {
      await job.log(`Aggregation FAILED: ${error.message}`);
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
            extractionSummary: receipt.results?.extraction
              ? {
                  hasSupplier: !!receipt.results.extraction.supplier,
                  hasAmount: !!receipt.results.extraction.transactionAmount,
                  hasDate: !!receipt.results.extraction.transactionDate,
                  issueCount: receipt.results.issues?.length || 0,
                }
              : null,
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
