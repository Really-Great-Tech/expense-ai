import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '@/common/constants/queue.constants';
import { RedisConfigService } from '@/config/redis.config';
import { AppConfigType } from '@/config/app.config';
import {
  SplitExpenseJobData,
  ProcessReceiptJobData,
  ProcessExpenseJobData,
} from '../interfaces/workflow-job-data.interface';
import { DocumentSplitterHandler } from '../handlers/document-splitter.handler';
import { ReceiptProcessorHandler } from '../handlers/receipt-processor.handler';
import { ResultAggregatorHandler } from '../handlers/result-aggregator.handler';
import { FlowProducerService } from './flow-producer.service';
import { JobRecordRepository } from '../repositories/job-record.repository';
import { ReceiptProcessingResultRepository } from '@/expense-result/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/expense-result/entities/receipt-processing-result.entity';
import { DocumentPersistenceService } from '@/expense-document/services/document-persistence.service';
import { ReceiptStatus } from '@/expense-document/entities/receipt.entity';

export interface ProcessExpenseResult {
  status: 'success' | 'partial-success' | 'failure';
  successCount: number;
  failedCount: number;
  failedReceiptIds?: string[];
}

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private worker: Worker | null = null;
  private isShuttingDown = false;
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private readonly defaultAttempts: number;
  private readonly appConfig: AppConfigType;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisConfigService: RedisConfigService,
    private readonly flowProducerService: FlowProducerService,
    @Inject(forwardRef(() => DocumentSplitterHandler))
    private readonly documentSplitterHandler: DocumentSplitterHandler,
    @Inject(forwardRef(() => ReceiptProcessorHandler))
    private readonly receiptProcessorHandler: ReceiptProcessorHandler,
    @Inject(forwardRef(() => ResultAggregatorHandler))
    private readonly resultAggregatorHandler: ResultAggregatorHandler,
    private readonly jobRecordRepository: JobRecordRepository,
    private readonly receiptProcessingResultRepo: ReceiptProcessingResultRepository,
    private readonly documentPersistenceService: DocumentPersistenceService,
  ) {
    this.appConfig = this.configService.get<AppConfigType>('app')!;
    this.concurrency = this.appConfig.workers.concurrency;
    this.timeoutMs = this.appConfig.workers.jobTimeout;
    this.defaultAttempts = this.appConfig.workers.maxRetryAttempts;
  }

  async onModuleInit(): Promise<void> {
    await this.start();
    this.setupSignalHandlers();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Set up SIGTERM and SIGINT signal handlers for graceful shutdown.
   */
  private setupSignalHandlers(): void {
    const handleShutdown = async (signal: string): Promise<void> => {
      this.logger.log(`Received ${signal}, initiating graceful shutdown`);
      await this.stop();
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    this.logger.debug('Signal handlers registered for graceful shutdown');
  }

  async start(): Promise<void> {
    if (this.worker) {
      this.logger.warn('Worker already running');
      return;
    }

    // Reuse existing Redis connection from RedisConfigService
    const bullConfig = this.redisConfigService.createSharedConfiguration();

    this.worker = new Worker(
      QUEUE_NAMES.EXPENSE_WORKFLOW,
      async (job: Job) => this.processJob(job),
      {
        connection: bullConfig.connection,
        prefix: bullConfig.prefix,
        concurrency: this.concurrency,
      },
    );

    // Set up Worker event listeners for audit trail
    this.setupEventListeners();

    this.logger.log(`WorkerService started: queue=${QUEUE_NAMES.EXPENSE_WORKFLOW}, concurrency=${this.concurrency}, timeout=${this.timeoutMs}ms`);
  }

  /**
   * Set up Worker event listeners for MySQL audit trail.
   */
  private setupEventListeners(): void {
    if (!this.worker) return;

    // Job started processing
    this.worker.on('active', async (job: Job) => {
      try {
        await this.jobRecordRepository.markStarted(job.id!);
        this.logger.debug(`Job activated: ${job.id} (${job.name})`);
      } catch (error) {
        this.logger.error(`Failed to mark job as started: ${error.message}`);
      }
    });

    // Job completed successfully
    this.worker.on('completed', async (job: Job) => {
      try {
        const processingTimeMs = job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : 0;
        await this.jobRecordRepository.markCompleted(job.id!, processingTimeMs);
        this.logger.debug(`Job completed: ${job.id} (${processingTimeMs}ms)`);
      } catch (error) {
        this.logger.error(`Failed to mark job as completed: ${error.message}`);
      }
    });

    // Job failed
    this.worker.on('failed', async (job: Job | undefined, err: Error) => {
      if (!job) return;

      try {
        const isExhausted = job.attemptsMade >= (job.opts?.attempts || this.defaultAttempts);

        if (isExhausted) {
          await this.jobRecordRepository.markFailed(job.id!, err.message);
          this.logger.debug(`Job failed (exhausted): ${job.id}, attempts=${job.attemptsMade}`);
        } else {
          await this.jobRecordRepository.markRetrying(job.id!, err.message);
          this.logger.debug(`Job failed (retrying): ${job.id}, attempts=${job.attemptsMade}`);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update job status on failure: ${updateError.message}`);
      }
    });
  }

  /**
   * Stop the worker with graceful shutdown.
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('Stopping WorkerService - graceful shutdown initiated');

    // Close Worker first (stops accepting jobs, waits for current jobs to finish)
    if (this.worker) {
      this.logger.log('Closing Worker...');
      await this.worker.close();
      this.worker = null;
      this.logger.log('Worker closed');
    }

    // Close FlowProducer
    if (this.flowProducerService) {
      this.logger.log('Closing FlowProducerService...');
      await this.flowProducerService.close();
      this.logger.log('FlowProducerService closed');
    }

    this.logger.log('WorkerService graceful shutdown complete');
  }

  isRunning(): boolean {
    return this.worker !== null && !this.isShuttingDown;
  }

  private async processJob(job: Job): Promise<unknown> {
    const jobName = job.name;

    this.logger.log(`Processing job: ${job.id} (${jobName}), attempt ${job.attemptsMade + 1}`);

    try {
      // Wrap job processing with timeout protection
      return await this.withTimeout(job, async () => {
        switch (jobName) {
          case JOB_NAMES.SPLIT_EXPENSE:
            return await this.handleSplitExpense(job as Job<SplitExpenseJobData>);

          case JOB_NAMES.PROCESS_RECEIPT:
            return await this.handleProcessReceipt(job as Job<ProcessReceiptJobData>);

          case JOB_NAMES.PROCESS_EXPENSE:
            return await this.handleProcessExpense(job as Job<ProcessExpenseJobData>);

          default:
            throw new Error(`Unknown job name: ${jobName}`);
        }
      });
    } catch (error) {
      this.logger.error(`Job failed: ${job.id} (${jobName}), error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Wrap a job handler with timeout protection.
   * Uses AbortController-based approach with Promise.race pattern.
   */
  private async withTimeout<T>(job: Job, handler: () => Promise<T>): Promise<T> {
    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Job ${job.id} timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });

    try {
      const result = await Promise.race([handler(), timeoutPromise]);
      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Handle split-expense job.
   * Calls DocumentSplitterHandler, then creates FlowProducer flow with parent-child jobs.
   *
   * Steps:
   * 1. Call DocumentSplitterHandler to split document into receipts
   * 2. Create processing result records for each receipt (QUEUED status)
   * 3. Update receipt status to PROCESSING
   * 4. Create parent-child flow using FlowProducerService
   */
  private async handleSplitExpense(job: Job<SplitExpenseJobData>): Promise<{ status: string; receiptCount: number }> {
    const jobData = job.data;

    this.logger.log(`Handling split-expense job: documentId=${jobData.documentId}`);

    // Step 1: Call the document splitter handler
    const splitResult = await this.documentSplitterHandler.handle(jobData);

    if (splitResult.receipts.length === 0) {
      this.logger.warn(`No receipts found in document: ${jobData.documentId}`);
      return {
        status: 'split-success',
        receiptCount: 0,
      };
    }

    // Step 2 & 3: Create processing result records and update receipt status
    for (let i = 0; i < splitResult.receipts.length; i++) {
      const receipt = splitResult.receipts[i];
      const childJobId = `receipt-${jobData.documentId}-${i}`;

      try {
        // Create processing result record in database (QUEUED status)
        await this.receiptProcessingResultRepo.create({
          receiptId: receipt.id,
          sourceDocumentId: receipt.sourceDocumentId,
          processingJobId: childJobId,
          status: ProcessingStatus.QUEUED,
        });

        // Update receipt status to PROCESSING with jobId in metadata
        await this.documentPersistenceService.updateReceiptStatus(receipt.id, ReceiptStatus.PROCESSING, { jobId: childJobId } as any);

        this.logger.debug(`Prepared receipt ${receipt.id} for processing (jobId: ${childJobId})`);
      } catch (error) {
        this.logger.error(`Failed to prepare receipt ${receipt.id}: ${error.message}`);
        // Continue with other receipts - partial success is acceptable
      }
    }

    // Step 4: Create parent-child flow using FlowProducerService
    await this.flowProducerService.createExpenseFlow({
      documentId: jobData.documentId,
      userId: jobData.userId,
      country: jobData.country,
      icp: jobData.icp,
      documentReader: jobData.documentReader,
      receipts: splitResult.receipts,
    });

    this.logger.log(`Created expense flow: documentId=${jobData.documentId}, receipts=${splitResult.receipts.length}`);

    return {
      status: 'split-success',
      receiptCount: splitResult.receipts.length,
    };
  }

  /**
   * Handle process-receipt job (child job in FlowProducer).
   * Calls ReceiptProcessorHandler to extract data from a single receipt.
   */
  private async handleProcessReceipt(job: Job<ProcessReceiptJobData>): Promise<{ receiptId: string }> {
    const jobData = job.data;

    this.logger.log(`Handling process-receipt job: receiptId=${jobData.receiptId}, documentId=${jobData.sourceDocumentId}`);

    // Pass ProcessReceiptJobData directly to handler
    await this.receiptProcessorHandler.handle(jobData);

    return {
      receiptId: jobData.receiptId,
    };
  }

  /**
   * Handle process-expense job (parent job in FlowProducer).
   * Called after all child process-receipt jobs complete.
   * Aggregates results using ExpenseStatusService.
   */
  private async handleProcessExpense(job: Job<ProcessExpenseJobData>): Promise<ProcessExpenseResult> {
    const { documentId } = job.data;

    this.logger.log(`Handling process-expense job: documentId=${documentId}`);

    // Get results from successful child jobs
    const childrenValues = await job.getChildrenValues();

    // Get failed children that were ignored (due to ignoreDependencyOnFailure: true)
    const ignoredChildren = await job.getIgnoredChildrenFailures();
    const failedKeys = Object.keys(ignoredChildren || {});

    // Calculate counts
    const successfulResults = Object.values(childrenValues) as Array<{ receiptId: string }>;
    const successCount = successfulResults.length;
    const failedCount = failedKeys.length;

    // Determine status
    let status: 'success' | 'partial-success' | 'failure';
    if (failedCount === 0) {
      status = 'success';
    } else if (successCount === 0) {
      status = 'failure';
    } else {
      status = 'partial-success';
    }

    // Extract failed receipt IDs from job keys
    const failedReceiptIds = failedKeys.map((key: string) => {
      const match = key.match(/receipt-\w+-(\d+)/);
      return match ? match[1] : key;
    });

    this.logger.log(`Aggregated expense results: documentId=${documentId}, status=${status}, success=${successCount}, failed=${failedCount}`);

    // Call ResultAggregatorHandler to finalize and optionally send webhook
    await this.resultAggregatorHandler.handle({ documentId });

    return {
      status,
      successCount,
      failedCount,
      failedReceiptIds: failedReceiptIds.length > 0 ? failedReceiptIds : undefined,
    };
  }
}
