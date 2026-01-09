import { Injectable, Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { RedisConfigService } from '@/config/redis.config';
import { QUEUE_NAMES, CIRCUIT_BREAKER_JOB_NAMES } from '@/common/constants/queue.constants';
import { ConfigService } from '@nestjs/config';
import { AppConfigType } from '@/config/app.config';

/**
 * Callback function type for executing queued requests
 */
export type CircuitBreakerCallback<T = any> = () => Promise<T>;

/**
 * Callback registry entry
 */
export interface CallbackRegistryEntry {
  callback: CircuitBreakerCallback;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  queuedAt: number;
}

/**
 * Represents a queued circuit breaker request
 */
export interface CircuitBreakerRequest<T = any> {
  /** Circuit breaker name (e.g., 'bedrock', 'textract', 's3') */
  breakerName: string;
  /** Unique request ID for tracking */
  requestId: string;
  /** Callback ID to look up in registry */
  callbackId: string;
  /** Timestamp when request was queued */
  queuedAt: number;
  /** Optional metadata for logging/debugging */
  metadata?: Record<string, any>;
}

/**
 * Result of executing a circuit breaker request
 */
export interface CircuitBreakerRequestResult<T = any> {
  requestId: string;
  breakerName: string;
  success: boolean;
  result?: T;
  error?: string;
  executedAt: number;
}

/**
 * Circuit Breaker Queue Service
 *
 * Manages queuing of requests when circuit breakers are open.
 * When a circuit opens, requests are enqueued instead of failing fast.
 * When the circuit transitions to half-open, the worker processes queued requests.
 */
@Injectable()
export class CircuitBreakerQueueService {
  private readonly logger = new Logger(CircuitBreakerQueueService.name);
  private queue: Queue | null = null;
  private readonly appConfig: AppConfigType;
  /** Callback registry for storing functions to execute */
  private readonly callbackRegistry = new Map<string, CallbackRegistryEntry>();
  /** Maximum age for callbacks before cleanup (1 hour) */
  private readonly MAX_CALLBACK_AGE = 60 * 60 * 1000;

  constructor(
    private readonly redisConfigService: RedisConfigService,
    private readonly configService: ConfigService,
  ) {
    this.appConfig = this.configService.get<AppConfigType>('app')!;
    // Cleanup old callbacks periodically
    this.startCallbackCleanup();
  }

  /**
   * Initialize the queue (call in onModuleInit)
   */
  async initialize(): Promise<void> {
    if (this.queue) {
      this.logger.warn('Queue already initialized');
      return;
    }

    const bullConfig = this.redisConfigService.createSharedConfiguration();

    this.queue = new Queue(QUEUE_NAMES.CIRCUIT_BREAKER, {
      connection: bullConfig.connection,
      prefix: bullConfig.prefix,
      defaultJobOptions: {
        ...bullConfig.defaultJobOptions,
        // Circuit breaker requests should have higher priority
        priority: 1,
        // Remove completed jobs after 1 hour
        removeOnComplete: {
          count: 100,
          age: 3600,
        },
        // Keep failed jobs for debugging
        removeOnFail: {
          count: 50,
          age: 86400,
        },
      },
    });

    this.logger.log(`Circuit breaker queue initialized: ${QUEUE_NAMES.CIRCUIT_BREAKER}`);
  }

  /**
   * Enqueue a request when circuit breaker is open
   * Returns a promise that resolves when the request is processed
   */
  async enqueueRequest<T>(
    breakerName: string,
    callback: CircuitBreakerCallback<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    if (!this.queue) {
      throw new Error('Circuit breaker queue not initialized. Call initialize() first.');
    }

    const requestId = `${breakerName}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const callbackId = `cb-${requestId}`;

    // Store callback in registry with promise resolvers
    return new Promise<T>((resolve, reject) => {
      this.callbackRegistry.set(callbackId, {
        callback,
        resolve,
        reject,
        queuedAt: Date.now(),
      });

      const request: CircuitBreakerRequest = {
        breakerName,
        requestId,
        callbackId,
        queuedAt: Date.now(),
        metadata,
      };

      // Enqueue the job
      this.queue!
        .add(CIRCUIT_BREAKER_JOB_NAMES.EXECUTE_REQUEST, request, {
          jobId: requestId,
          attempts: 1, // Don't retry - circuit breaker handles retries
        })
        .then(() => {
          this.logger.debug(
            `Enqueued circuit breaker request: breaker=${breakerName}, requestId=${requestId}`,
          );
        })
        .catch((error) => {
          // Clean up registry entry on enqueue failure
          this.callbackRegistry.delete(callbackId);
          reject(new Error(`Failed to enqueue circuit breaker request: ${error.message}`));
        });
    });
  }

  /**
   * Get callback from registry by ID
   */
  getCallback(callbackId: string): CallbackRegistryEntry | undefined {
    return this.callbackRegistry.get(callbackId);
  }

  /**
   * Remove callback from registry after execution
   */
  removeCallback(callbackId: string): void {
    this.callbackRegistry.delete(callbackId);
  }

  /**
   * Start periodic cleanup of old callbacks
   */
  private startCallbackCleanup(): void {
    setInterval(() => {
      this.cleanupOldCallbacks();
    }, 15 * 60 * 1000); // Run every 15 minutes
  }

  /**
   * Clean up callbacks older than MAX_CALLBACK_AGE
   */
  private cleanupOldCallbacks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [callbackId, entry] of this.callbackRegistry.entries()) {
      if (now - entry.queuedAt > this.MAX_CALLBACK_AGE) {
        // Reject with timeout error
        entry.reject(new Error('Circuit breaker request timeout: request exceeded maximum wait time'));
        this.callbackRegistry.delete(callbackId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.warn(`Cleaned up ${cleaned} expired callback(s) from registry`);
    }
  }

  /**
   * Get pending jobs for a specific circuit breaker
   */
  async getPendingJobs(breakerName: string, limit: number = 10): Promise<Job<CircuitBreakerRequest>[]> {
    if (!this.queue) {
      return [];
    }

    const jobs = await this.queue.getJobs(['waiting', 'delayed'], 0, limit);
    return jobs.filter((job) => job.data?.breakerName === breakerName);
  }

  /**
   * Get job by request ID
   */
  async getJob(requestId: string): Promise<Job<CircuitBreakerRequest> | null> {
    if (!this.queue) {
      return null;
    }

    return await this.queue.getJob(requestId);
  }

  /**
   * Get queue metrics for monitoring
   */
  async getQueueMetrics(breakerName?: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * Close the queue gracefully
   */
  async close(): Promise<void> {
    if (this.queue) {
      this.logger.log('Closing circuit breaker queue...');
      await this.queue.close();
      this.queue = null;
      this.logger.log('Circuit breaker queue closed');
    }
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue(): Queue | null {
    return this.queue;
  }
}
