import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlowProducer, FlowJob, FlowChildJob } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/common/constants/queue.constants';
import { RedisConfigService } from '@/config/redis.config';
import { ProcessReceiptJobData, ProcessExpenseJobData, CreateExpenseFlowParams } from '../interfaces/workflow-job-data.interface';
import { JobRecordRepository } from '../repositories/job-record.repository';
import { JobType } from '../entities/job-record.entity';

@Injectable()
export class FlowProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(FlowProducerService.name);
  private readonly flowProducer: FlowProducer;
  private readonly defaultAttempts: number;
  private readonly backoffDelayMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisConfigService: RedisConfigService,
    private readonly jobRecordRepository: JobRecordRepository,
  ) {
    // Reuse existing Redis connection from RedisConfigService
    const bullConfig = this.redisConfigService.createSharedConfiguration();

    this.flowProducer = new FlowProducer({
      connection: bullConfig.connection,
      prefix: bullConfig.prefix,
    });

    // 4 attempts with 35s backoff ensures retries hit circuit breaker AFTER it recovers (15-30s halfOpenAfter)
    this.defaultAttempts = this.configService.get<number>('WORKER_MAX_RETRY_ATTEMPTS', 4);
    this.backoffDelayMs = this.configService.get<number>('WORKER_BACKOFF_DELAY_MS', 35000);

    this.logger.log('FlowProducerService initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  /**
   * Create a parent-child job flow for expense processing.
   *
   * The flow structure:
   * - Parent job (process-expense): Aggregates results after all children complete
   * - Child jobs (process-receipt): Process individual receipts in parallel
   *
   * @param params - The document and receipt data for the flow
   * @returns The parent job ID
   */
  async createExpenseFlow(params: CreateExpenseFlowParams): Promise<string> {
    const { documentId, userId, country, icp, documentReader, receipts } = params;

    if (receipts.length === 0) {
      this.logger.warn(`No receipts to process for document ${documentId}, creating parent job only`);
    }

    // Create child jobs for each receipt
    const children: FlowChildJob[] = receipts.map((receipt, index) => {
      const jobData: ProcessReceiptJobData = {
        receiptId: receipt.id,
        sourceDocumentId: receipt.sourceDocumentId,
        userId,
        country,
        icp,
        documentReader,
        image: receipt.image,
      };

      return {
        name: JOB_NAMES.PROCESS_RECEIPT,
        queueName: QUEUE_NAMES.EXPENSE_WORKFLOW,
        data: jobData,
        opts: {
          jobId: `receipt-${documentId}-${index}`,
          attempts: this.defaultAttempts,
          backoff: {
            type: 'exponential' as const,
            delay: this.backoffDelayMs,
            jitter: 0.5,
          },
          // Allow parent to run even if this child fails (for partial success handling)
          ignoreDependencyOnFailure: true,
          removeOnComplete: {
            age: 3600, // 1 hour (reduced from 24 hours)
            count: 500,
          },
          removeOnFail: {
            age: 604800, // 7 days
            count: 200,
          },
        },
      };
    });

    // Create parent job data
    const parentData: ProcessExpenseJobData = {
      documentId,
      userId,
      country,
      icp,
    };

    // Create the flow with parent waiting for all children
    const flow: FlowJob = {
      name: JOB_NAMES.PROCESS_EXPENSE,
      queueName: QUEUE_NAMES.EXPENSE_WORKFLOW,
      data: parentData,
      children,
      opts: {
        jobId: `expense-${documentId}`,
        attempts: this.defaultAttempts,
        backoff: {
          type: 'exponential' as const,
          delay: this.backoffDelayMs,
          jitter: 0.5,
        },
        removeOnComplete: {
          age: 7200, // 2 hours (reduced from 24 hours)
          count: 100,
        },
        removeOnFail: {
          age: 604800, // 7 days
          count: 200,
        },
      },
    };

    const result = await this.flowProducer.add(flow);
    const parentJobId = result.job.id!;

    // Create job records for audit trail
    try {
      // Create parent job record (process-expense)
      await this.jobRecordRepository.create({
        bullmqJobId: parentJobId,
        type: 'process-expense' as JobType,
        documentId,
        maxAttempts: this.defaultAttempts,
        metadata: { userId, country, icp },
      });

      // Create child job records (process-receipt)
      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        const childJobId = `receipt-${documentId}-${i}`;
        await this.jobRecordRepository.create({
          bullmqJobId: childJobId,
          type: 'process-receipt' as JobType,
          documentId,
          receiptId: receipt.id,
          parentJobId,
          maxAttempts: this.defaultAttempts,
          metadata: { receiptIndex: i },
        });
      }
    } catch (error) {
      // Log but don't fail the flow creation - audit trail is non-critical
      this.logger.error(`Failed to create job records for audit trail: ${error.message}`, error.stack);
    }

    this.logger.log(`Expense flow created: documentId=${documentId}, parentJobId=${parentJobId}, children=${receipts.length}`);

    return parentJobId;
  }

  /**
   * Close the FlowProducer connection.
   */
  async close(): Promise<void> {
    this.logger.log('Closing FlowProducerService');
    await this.flowProducer.close();
    this.logger.log('FlowProducerService closed');
  }
}
