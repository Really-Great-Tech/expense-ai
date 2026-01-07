import { Injectable, Logger } from '@nestjs/common';
import { Receipt, ReceiptStatus } from '@/expense-document/entities/receipt.entity';
import { DocumentPersistenceService } from './document-persistence.service';
import { ReceiptProcessingResultRepository } from '@/expense-result/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/expense-result/entities/receipt-processing-result.entity';
import { FlowProducerService } from '@/workflow/services/flow-producer.service';

@Injectable()
export class ProcessingQueueService {
  private readonly logger = new Logger(ProcessingQueueService.name);

  constructor(
    private readonly persistenceService: DocumentPersistenceService,
    private readonly receiptProcessingResultRepo: ReceiptProcessingResultRepository,
    private readonly flowProducerService: FlowProducerService,
  ) {}

  /**
   * Enqueue receipt processing using the FlowProducer workflow.
   * Creates a parent-child job structure where the parent waits for all children to complete.
   *
   * Steps performed for each receipt:
   * 1. Create processing result record in database (QUEUED status)
   * 2. Update receipt status to PROCESSING
   * 3. Create FlowProducer parent-child job structure
   *
   * @param documentId Parent document ID
   * @param receipts Array of receipts (already created during splitting)
   * @param options Processing options (userId, country, icp, documentReader)
   * @returns Parent job ID
   */
  async enqueueReceiptProcessingWithFlow(
    documentId: string,
    receipts: Receipt[],
    options: {
      userId?: string;
      country?: string;
      icp?: string;
      documentReader?: string;
    },
  ): Promise<string> {
    this.logger.log(`Enqueueing ${receipts.length} receipts using FlowProducer for document ${documentId}`);

    // Step 1 & 2: Create processing result records and update receipt status
    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i];
      const jobId = `receipt-${documentId}-${i}`;

      try {
        // Create processing result record in database
        await this.receiptProcessingResultRepo.create({
          receiptId: receipt.id,
          sourceDocumentId: receipt.sourceDocumentId,
          processingJobId: jobId,
          status: ProcessingStatus.QUEUED,
        });

        // Update receipt status to PROCESSING with jobId in metadata
        const updatedMetadata = { ...receipt.metadata, jobId };
        await this.persistenceService.updateReceiptStatus(receipt.id, ReceiptStatus.PROCESSING, updatedMetadata as any);

        this.logger.debug(`Prepared receipt ${receipt.id} for FlowProducer (jobId: ${jobId})`);
      } catch (error) {
        this.logger.error(`Failed to prepare receipt ${receipt.id} for FlowProducer: ${error.message}`);
        // Continue with other receipts - partial success is acceptable
      }
    }

    // Step 3: Create expense flow with parent-child jobs
    const parentJobId = await this.flowProducerService.createExpenseFlow({
      documentId,
      userId: options.userId || 'anonymous',
      country: options.country || 'Unknown',
      icp: options.icp || 'DEFAULT',
      documentReader: options.documentReader,
      receipts: receipts.map((receipt) => ({
        id: receipt.id,
        sourceDocumentId: receipt.sourceDocumentId,
      })),
    });

    this.logger.log(`Created expense flow: parentJobId=${parentJobId}, children=${receipts.length}`);

    return parentJobId;
  }
}
