import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { RedisConfigService } from '@/config/redis.config';
import { QUEUE_NAMES, CIRCUIT_BREAKER_JOB_NAMES } from '@/common/constants/queue.constants';
import { AppConfigType } from '@/config/app.config';
import {
  CircuitBreakerQueueService,
  CircuitBreakerRequest,
  CircuitBreakerRequestResult,
} from './circuit-breaker-queue.service';
import { CircuitBreakerService } from '@/resilience/circuit-breaker.service';
import { CircuitState } from 'cockatiel';

/**
 * Circuit Breaker Worker Service
 *
 * Processes queued circuit breaker requests when the circuit transitions to half-open state.
 * This allows the circuit to test if the underlying service has recovered before fully closing.
 */
@Injectable()
export class CircuitBreakerWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerWorkerService.name);
  private worker: Worker | null = null;
  private isShuttingDown = false;
  private readonly concurrency: number;
  private readonly appConfig: AppConfigType;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisConfigService: RedisConfigService,
    @Inject(forwardRef(() => CircuitBreakerQueueService))
    private readonly queueService: CircuitBreakerQueueService,
    @Inject(forwardRef(() => CircuitBreakerService))
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    this.appConfig = this.configService.get<AppConfigType>('app')!;
    // Lower concurrency for circuit breaker requests - we want to test slowly
    this.concurrency = Math.max(1, Math.floor(this.appConfig.workers.concurrency / 2));
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

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.worker) {
      this.logger.warn('Worker already running');
      return;
    }

    // Ensure queue is initialized
    await this.queueService.initialize();

    const bullConfig = this.redisConfigService.createSharedConfiguration();

    this.worker = new Worker(
      QUEUE_NAMES.CIRCUIT_BREAKER,
      async (job: Job<CircuitBreakerRequest>) => this.processJob(job),
      {
        connection: bullConfig.connection,
        prefix: bullConfig.prefix,
        concurrency: this.concurrency,
      },
    );

    this.setupEventListeners();

    this.logger.log(
      `Circuit breaker worker started: queue=${QUEUE_NAMES.CIRCUIT_BREAKER}, concurrency=${this.concurrency}`,
    );
  }

  /**
   * Set up worker event listeners
   */
  private setupEventListeners(): void {
    if (!this.worker) return;

    this.worker.on('active', (job: Job) => {
      this.logger.debug(`Processing circuit breaker request: ${job.id} (${job.data?.breakerName})`);
    });

    this.worker.on('completed', (job: Job, result: CircuitBreakerRequestResult) => {
      this.logger.debug(
        `Circuit breaker request completed: ${job.id} (${job.data?.breakerName}), success=${result.success}`,
      );
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (!job) return;
      this.logger.error(
        `Circuit breaker request failed: ${job.id} (${job.data?.breakerName}), error: ${err.message}`,
      );
    });
  }

  /**
   * Stop the worker with graceful shutdown
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('Stopping circuit breaker worker - graceful shutdown initiated');

    if (this.worker) {
      this.logger.log('Closing worker...');
      await this.worker.close();
      this.worker = null;
      this.logger.log('Worker closed');
    }

    this.logger.log('Circuit breaker worker graceful shutdown complete');
  }

  isRunning(): boolean {
    return this.worker !== null && !this.isShuttingDown;
  }

  /**
   * Process a queued circuit breaker request
   * Only processes if the circuit is in half-open state (testing recovery)
   */
  private async processJob(job: Job<CircuitBreakerRequest>): Promise<CircuitBreakerRequestResult> {
    const request = job.data;
    const { breakerName, requestId, callbackId, metadata } = request;

    this.logger.log(
      `Processing circuit breaker request: breaker=${breakerName}, requestId=${requestId}`,
    );
    job.log(`Processing circuit breaker request: breaker=${breakerName}, requestId=${requestId}`);

    try {
      // Get callback from registry
      const callbackEntry = this.queueService.getCallback(callbackId);
      if (!callbackEntry) {
        throw new Error(`Callback not found for request ${requestId} (callbackId: ${callbackId})`);
      }

      // Check circuit state
      const breaker = this.circuitBreakerService.getBreaker(breakerName);
      const state = breaker.state;

      if (state === CircuitState.Open) {
        // Circuit is still open - should not process yet, re-queue or skip
        // This shouldn't happen if queue is only processed on half-open, but handle gracefully
        this.logger.debug(
          `Skipping request ${requestId}: circuit ${breakerName} is still open, waiting for half-open state`,
        );
        job.log(`Skipping request ${requestId}: circuit ${breakerName} is still open, waiting for half-open state`);

        callbackEntry.reject(new Error(`Circuit ${breakerName} is still open, request queued too early`));
        this.queueService.removeCallback(callbackId);

        return {
          requestId,
          breakerName,
          success: false,
          error: 'Circuit is still open',
          executedAt: Date.now(),
        };
      }

      // Circuit is either half-open (testing recovery) or closed (recovered)
      // Execute the callback through the circuit breaker
      // This allows the circuit breaker to track the success/failure
      const result = await breaker.execute(callbackEntry.callback);

      // Resolve the promise for the original caller
      callbackEntry.resolve(result);
      this.queueService.removeCallback(callbackId);

      this.logger.debug(
        `Successfully processed circuit breaker request: breaker=${breakerName}, requestId=${requestId}`,
      );
      job.log(`Successfully processed circuit breaker request: breaker=${breakerName}, requestId=${requestId}`);

      return {
        requestId,
        breakerName,
        success: true,
        result,
        executedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process circuit breaker request ${requestId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      job.log(`Failed to process circuit breaker request ${requestId}: ${errorMessage}`);

      // Reject the promise for the original caller
      const callbackEntry = this.queueService.getCallback(callbackId);
      if (callbackEntry) {
        callbackEntry.reject(error);
        this.queueService.removeCallback(callbackId);
      }

      return {
        requestId,
        breakerName,
        success: false,
        error: errorMessage,
        executedAt: Date.now(),
      };
    }
  }

  /**
   * Process pending requests for a specific circuit breaker
   * Called when circuit transitions to half-open state
   */
  async processPendingRequests(breakerName: string, limit: number = 5): Promise<void> {
    if (!this.worker || this.isShuttingDown) {
      this.logger.warn('Worker not running, cannot process pending requests');
      return;
    }

    const pendingJobs = await this.queueService.getPendingJobs(breakerName, limit);

    if (pendingJobs.length === 0) {
      this.logger.debug(`No pending requests for circuit breaker: ${breakerName}`);
      return;
    }

    this.logger.log(
      `Processing ${pendingJobs.length} pending requests for circuit breaker: ${breakerName}`,
    );

    // Jobs will be processed automatically by the worker
    // We just need to ensure they're in the queue, which they already are
    // The worker will pick them up based on concurrency limits
  }
}
