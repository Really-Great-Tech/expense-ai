import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptProcessingResult, ProcessingStatus } from '../entities/receipt-processing-result.entity';

@Injectable()
export class ReceiptProcessingResultRepository {
  private readonly logger = new Logger(ReceiptProcessingResultRepository.name);

  constructor(
    @InjectRepository(ReceiptProcessingResult)
    public readonly repository: Repository<ReceiptProcessingResult>,
  ) {}

  async create(data: {
    receiptId: string;
    sourceDocumentId: string;
    processingJobId: string;
    status?: ProcessingStatus;
  }): Promise<ReceiptProcessingResult> {
    try {
      const result = this.repository.create({
        ...data,
        status: data.status || ProcessingStatus.QUEUED,
        processingMetadata: {},
        fileReferences: { originalReceipt: '' },
      });

      const saved = await this.repository.save(result);
      this.logger.log(`Created processing result record for receipt ${data.receiptId}`);

      return saved;
    } catch (error) {
      this.logger.error(`Failed to create processing result for receipt ${data.receiptId}:`, error);
      throw error;
    }
  }

  async updateStatus(
    receiptId: string,
    status: ProcessingStatus,
    additionalData?: Partial<ReceiptProcessingResult>,
  ): Promise<void> {
    try {
      const updateData: any = { status, ...additionalData };

      // Set processing start time if moving to PROCESSING
      if (status === ProcessingStatus.PROCESSING && !additionalData?.processingStartedAt) {
        updateData.processingStartedAt = new Date();
      }

      await this.repository.update({ receiptId }, updateData);
      this.logger.log(`Updated status for receipt ${receiptId} to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update status for receipt ${receiptId}:`, error);
      throw error;
    }
  }

  async saveResults(
    receiptId: string,
    results: {
      classificationResult?: any;
      extractedData?: any;
      complianceValidation?: any;
      qualityAssessment?: any;
      citationData?: any;
      processingMetadata?: any;
      fileReferences?: any;
    },
  ): Promise<void> {
    try {
      await this.repository.update(
        { receiptId },
        {
          ...results,
          status: ProcessingStatus.COMPLETED,
          processingCompletedAt: new Date(),
        },
      );
      this.logger.log(`Saved complete processing results for receipt ${receiptId}`);
    } catch (error) {
      this.logger.error(`Failed to save results for receipt ${receiptId}:`, error);
      throw error;
    }
  }

  async findByReceiptId(receiptId: string): Promise<ReceiptProcessingResult | null> {
    try {
      return await this.repository.findOne({
        where: { receiptId },
        relations: ['receipt', 'sourceDocument'],
      });
    } catch (error) {
      this.logger.error(`Failed to find processing result for receipt ${receiptId}:`, error);
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<ReceiptProcessingResult | null> {
    try {
      return await this.repository.findOne({
        where: { processingJobId: jobId },
      });
    } catch (error) {
      this.logger.error(`Failed to find processing result for job ${jobId}:`, error);
      throw error;
    }
  }

  async findByDocumentId(documentId: string): Promise<ReceiptProcessingResult[]> {
    try {
      return await this.repository.find({
        where: { sourceDocumentId: documentId },
        relations: ['receipt'],
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(`Failed to find processing results for document ${documentId}:`, error);
      throw error;
    }
  }

  async markFailed(receiptId: string, error: Error): Promise<void> {
    try {
      await this.repository.update(
        { receiptId },
        {
          status: ProcessingStatus.FAILED,
          errorMessage: error.message,
          errorStack: error.stack,
          processingCompletedAt: new Date(),
        },
      );
      this.logger.log(`Marked receipt ${receiptId} as failed: ${error.message}`);
    } catch (updateError) {
      this.logger.error(`Failed to mark receipt ${receiptId} as failed:`, updateError);
      throw updateError;
    }
  }

  async getProcessingStats(documentId?: string): Promise<any> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('result');

      if (documentId) {
        queryBuilder.where('result.sourceDocumentId = :documentId', { documentId });
      }

      const results = await queryBuilder.getMany();

      const stats = {
        total: results.length,
        queued: results.filter((r) => r.status === ProcessingStatus.QUEUED).length,
        processing: results.filter((r) => r.status === ProcessingStatus.PROCESSING).length,
        completed: results.filter((r) => r.status === ProcessingStatus.COMPLETED).length,
        failed: results.filter((r) => r.status === ProcessingStatus.FAILED).length,
        averageProcessingTime: 0,
      };

      // Calculate average processing time for completed items
      const completedResults = results.filter(
        (r) => r.status === ProcessingStatus.COMPLETED && r.processingStartedAt && r.processingCompletedAt,
      );

      if (completedResults.length > 0) {
        const totalTime = completedResults.reduce((sum, r) => {
          const duration = r.processingCompletedAt.getTime() - r.processingStartedAt.getTime();
          return sum + duration;
        }, 0);
        stats.averageProcessingTime = Math.round(totalTime / completedResults.length / 1000); // seconds
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get processing stats:', error);
      throw error;
    }
  }
}
