import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Receipt, ReceiptStatus } from '@/document/entities/receipt.entity';
import { QUEUE_NAMES, JOB_TYPES, DocumentProcessingData } from '@/types';
import { DocumentPersistenceService } from './document-persistence.service';
import { ReceiptProcessingResultRepository } from '@/document/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/document/entities/receipt-processing-result.entity';

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

    for (const receipt of receipts) {
      try {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        await this.receiptProcessingResultRepo.create({
          receiptId: receipt.id,
          sourceDocumentId: receipt.sourceDocumentId,
          processingJobId: jobId,
          status: ProcessingStatus.QUEUED,
        });

        // Queue the job
        await this.expenseQueue.add(JOB_TYPES.PROCESS_DOCUMENT, jobData, {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        });

        const updatedMetadata = { ...receipt.metadata, jobId };
        await this.persistenceService.updateReceiptStatus(receipt.id, ReceiptStatus.PROCESSING, updatedMetadata as any);

        this.logger.log(`Enqueued processing job for receipt ${receipt.id} with DB record`, { jobId });
      } catch (error) {
        this.logger.warn(`Failed to enqueue processing for receipt ${receipt.id}:`, error);
      }
    }
  }
}
