import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Receipt, ReceiptStatus } from '@/expense-document/entities/receipt.entity';
import { QUEUE_NAMES, JOB_TYPES, DocumentProcessingData } from '@/common/types';
import { DocumentPersistenceService } from './document-persistence.service';
import { ReceiptProcessingResultRepository } from '@/expense-result/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/expense-result/entities/receipt-processing-result.entity';

@Injectable()
export class ProcessingQueueService {
  private readonly logger = new Logger(ProcessingQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EXPENSE_PROCESSING) private readonly expenseQueue: Queue,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly receiptProcessingResultRepo: ReceiptProcessingResultRepository,
  ) {}

  async enqueueReceiptProcessing(receipts: Receipt[], options: any): Promise<void> {
    const parentTimestamp = Date.now();
    this.logger.log(`Starting receipt enqueueing process for ${receipts.length} receipts`);

    for (const receipt of receipts) {
      const receiptStartTime = Date.now();
      try {
        this.logger.log(`Processing receipt ${receipt.id} (${receipt.fileName})`);

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const jobData: DocumentProcessingData = {
          jobId,
          storageKey: receipt.storageKey,
          storageType: receipt.storageType,
          storageBucket: receipt.storageBucket,
          fileName: receipt.fileName,
          userId: options.userId || 'anonymous',
          country: options.country || 'Unknown',
          icp: options.icp || 'DEFAULT',
          documentReader: options.documentReader || 'textract',
          uploadedAt: new Date(),
          actualUserId: options.userId || 'anonymous',
          sessionId: `session_${parentTimestamp}`,
          receiptId: receipt.id,
        };

        // Create processing result record in database
        const dbStartTime = Date.now();
        this.logger.log(`Creating DB processing result record for receipt ${receipt.id}`);
        await this.receiptProcessingResultRepo.create({
          receiptId: receipt.id,
          sourceDocumentId: receipt.sourceDocumentId,
          processingJobId: jobId,
          status: ProcessingStatus.QUEUED,
        });
        this.logger.log(`DB record created in ${Date.now() - dbStartTime}ms for receipt ${receipt.id}`);

        // Queue the job - THIS IS WHERE IT HANGS
        const queueStartTime = Date.now();
        this.logger.log(`Adding job to Bull queue for receipt ${receipt.id}, jobId: ${jobId}`);
        this.logger.log(`Queue details: { name: "${QUEUE_NAMES.EXPENSE_PROCESSING}", type: "${JOB_TYPES.PROCESS_DOCUMENT}" }`);

        try {
          await this.expenseQueue.add(JOB_TYPES.PROCESS_DOCUMENT, jobData, {
            jobId,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          });
          this.logger.log(`Job added to queue in ${Date.now() - queueStartTime}ms for receipt ${receipt.id}`);
        } catch (queueError) {
          this.logger.error(`QUEUE ADD FAILED for receipt ${receipt.id} after ${Date.now() - queueStartTime}ms:`, {
            error: queueError.message,
            stack: queueError.stack,
            jobId,
            receiptId: receipt.id,
          });
          throw queueError;
        }

        const updateStartTime = Date.now();
        this.logger.log(`Updating receipt status to PROCESSING for receipt ${receipt.id}`);
        const updatedMetadata = { ...receipt.metadata, jobId };
        await this.persistenceService.updateReceiptStatus(receipt.id, ReceiptStatus.PROCESSING, updatedMetadata as any);
        this.logger.log(`Receipt status updated in ${Date.now() - updateStartTime}ms`);

        const totalTime = Date.now() - receiptStartTime;
        this.logger.log(`Successfully enqueued processing job for receipt ${receipt.id} (total time: ${totalTime}ms)`, { jobId });
      } catch (error) {
        const totalTime = Date.now() - receiptStartTime;
        this.logger.error(`Failed to enqueue processing for receipt ${receipt.id} after ${totalTime}ms:`, {
          error: error.message,
          stack: error.stack,
          receiptId: receipt.id,
        });
      }
    }

    this.logger.log(`Completed receipt enqueueing process for ${receipts.length} receipts in ${Date.now() - parentTimestamp}ms`);
  }
}
