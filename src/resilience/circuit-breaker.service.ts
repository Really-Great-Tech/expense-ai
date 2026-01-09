import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import {
  CircuitBreakerPolicy,
  circuitBreaker,
  handleAll,
  ConsecutiveBreaker,
  CircuitState,
  BrokenCircuitError,
  retry,
  ExponentialBackoff,
  IPolicy,
  wrap,
} from 'cockatiel';
import { CircuitBreakerQueueService } from '@/workers/services/circuit-breaker-queue.service';
import { CircuitBreakerWorkerService } from '@/workers/services/circuit-breaker-worker.service';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  threshold: number;
  /** Time in ms to wait before trying half-open */
  halfOpenAfter: number;
  /** Enable queuing when circuit is open (default: true) */
  enableQueuing?: boolean;
}

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in ms before first retry */
  initialDelay: number;
  /** Maximum delay in ms between retries */
  maxDelay: number;
  /** Exponential factor for backoff (default: 2) */
  exponent?: number;
}

export interface CircuitBreakerStatus {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
}

/**
 * Create a proxy wrapper for CircuitBreakerPolicy that intercepts execute calls to use queuing
 */
/**
 * Create a proxy wrapper for CircuitBreakerPolicy that intercepts execute calls to use queuing
 * This ensures all breaker.execute() calls automatically get queuing support when circuit is open
 */
function createQueuedCircuitBreakerPolicy(
  breakerService: CircuitBreakerService,
  breakerName: string,
  underlyingPolicy: CircuitBreakerPolicy,
): CircuitBreakerPolicy {
  return new Proxy(underlyingPolicy, {
    get(target: CircuitBreakerPolicy, prop: string | symbol) {
      // Intercept execute method to route through executeWithQueue
      if (prop === 'execute') {
        // Wrap execute to automatically use queuing
        // This matches the signature: execute<T>(fn: (context?) => T | Promise<T>, signal?): Promise<T>
        return function <T>(fn: (context?: any) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
          // If AbortSignal is provided, we can't easily queue (would need to handle cancellation)
          // For now, if signal is provided, fall back to direct execution
          if (signal) {
            return target.execute(fn, signal);
          }

          // Ensure function returns Promise (handle both sync and async functions)
          const asyncFn = async () => {
            const result = fn();
            return result instanceof Promise ? result : Promise.resolve(result);
          };
          return breakerService.executeWithQueue(breakerName, asyncFn);
        };
      }
      // Forward all other property access to underlying policy
      const value = (target as any)[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as CircuitBreakerPolicy;
}

/**
 * Singleton instance for use in non-DI contexts (e.g., plain classes like BedrockLlmService)
 */
let globalCircuitBreakerService: CircuitBreakerService | null = null;

export function getGlobalCircuitBreakerService(): CircuitBreakerService {
  if (!globalCircuitBreakerService) {
    globalCircuitBreakerService = new CircuitBreakerService();
  }
  return globalCircuitBreakerService;
}

/**
 * Circuit Breaker Service
 *
 * Provides named circuit breakers for different external services.
 * Works alongside AWS SDK's built-in retries (maxAttempts: 4, adaptive mode):
 * - AWS SDK handles transient errors with retries
 * - Circuit breaker prevents cascading failures during sustained outages
 *
 * Flow: Request -> Circuit Breaker -> AWS SDK (retries) -> AWS Service
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreakerPolicy>();
  private readonly breakerConfigs = new Map<string, CircuitBreakerConfig>();
  private readonly wrappedPolicies = new Map<string, IPolicy>();
  private queueService: CircuitBreakerQueueService | null = null;
  private workerService: CircuitBreakerWorkerService | null = null;

  constructor(
    @Optional()
    @Inject(forwardRef(() => CircuitBreakerQueueService))
    queueService?: CircuitBreakerQueueService,
    @Optional()
    @Inject(forwardRef(() => CircuitBreakerWorkerService))
    workerService?: CircuitBreakerWorkerService,
  ) {
    // Optional injection - queue service may not be available in all contexts
    this.queueService = queueService || null;
    this.workerService = workerService || null;
  }

  /**
   * Set queue and worker services (for cases where DI doesn't work)
   */
  setQueueServices(queueService: CircuitBreakerQueueService, workerService: CircuitBreakerWorkerService): void {
    this.queueService = queueService;
    this.workerService = workerService;
  }

  /**
   * Pre-configured circuit breaker configs for different service types
   */
  private readonly defaultConfigs: Record<string, CircuitBreakerConfig> = {
    // LLM calls are slow, need longer recovery time
    bedrock: { threshold: 30, halfOpenAfter: 10_000 },
    // Textract can be rate-limited
    textract: { threshold: 3, halfOpenAfter: 20_000 },
    // S3 is usually reliable, higher threshold
    s3: { threshold: 5, halfOpenAfter: 15_000 },
    // Database operations need quick recovery
    database: { threshold: 5, halfOpenAfter: 10_000 },
  };

  /**
   * Pre-configured retry configs with exponential backoff + jitter
   */
  private readonly defaultRetryConfigs: Record<string, RetryConfig> = {
    // Bedrock: fewer retries since circuit breaker handles sustained failures
    bedrock: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000 },
    // Textract: similar to Bedrock
    textract: { maxAttempts: 2, initialDelay: 1000, maxDelay: 5000 },
    // S3: more retries for transient issues
    s3: { maxAttempts: 3, initialDelay: 500, maxDelay: 3000 },
    // Database: quick retries
    database: { maxAttempts: 3, initialDelay: 200, maxDelay: 2000 },
  };

  /**
   * Get or create a circuit breaker by name
   * Returns a wrapped breaker that automatically uses queuing when enabled
   */
  getBreaker(name: string, customConfig?: Partial<CircuitBreakerConfig>): CircuitBreakerPolicy {
    const existing = this.breakers.get(name);
    if (existing) {
      // Wrap existing breaker if queuing is now available (may have been set up after breaker creation)
      const config = this.breakerConfigs.get(name) || { enableQueuing: true };
      if (config.enableQueuing !== false && this.queueService) {
        // Return wrapped version to ensure execute calls use queuing
        return createQueuedCircuitBreakerPolicy(this, name, existing);
      }
      return existing;
    }

    const baseConfig = this.defaultConfigs[name] || { threshold: 3, halfOpenAfter: 15_000 };
    const config: CircuitBreakerConfig = { ...baseConfig, ...customConfig };

    const policy = circuitBreaker(handleAll, {
      halfOpenAfter: config.halfOpenAfter,
      breaker: new ConsecutiveBreaker(config.threshold),
    });

    // Log state changes and trigger queue processing
    policy.onStateChange((state) => {
      const stateName = this.getStateName(state);
      this.logger.warn(`Circuit breaker [${name}] state changed to: ${stateName}`);

      // When circuit transitions to half-open, process pending requests
      if (state === CircuitState.HalfOpen && config.enableQueuing !== false) {
        this.handleHalfOpenState(name);
      }
    });

    // onFailure receives: { duration, handled, reason: FailureReason }
    // FailureReason is: { error: Error } | { value: unknown }
    policy.onFailure(({ reason }) => {
      const errorMessage = 'error' in reason ? reason.error.message : 'Unknown';
      this.logger.warn(`Circuit breaker [${name}] recorded failure: ${errorMessage}`);
    });

    policy.onSuccess(() => {
      this.logger.debug(`Circuit breaker [${name}] recorded success`);
    });

    this.breakers.set(name, policy);
    this.breakerConfigs.set(name, config);

    this.logger.log(`Circuit breaker [${name}] created: threshold=${config.threshold}, halfOpenAfter=${config.halfOpenAfter}ms`);

    // Wrap the policy to automatically use queuing when enabled
    if (config.enableQueuing !== false && this.queueService) {
      return createQueuedCircuitBreakerPolicy(this, name, policy);
    }

    return policy;
  }

  /**
   * Convenience getters for common services
   */
  getBedrockBreaker(): CircuitBreakerPolicy {
    return this.getBreaker('bedrock');
  }

  getTextractBreaker(): CircuitBreakerPolicy {
    return this.getBreaker('textract');
  }

  getS3Breaker(): CircuitBreakerPolicy {
    return this.getBreaker('s3');
  }

  getDatabaseBreaker(): CircuitBreakerPolicy {
    return this.getBreaker('database');
  }

  /**
   * Get a wrapped policy combining retry (with exponential backoff + jitter) and circuit breaker
   * Order: Retry wraps CircuitBreaker - so retries happen outside the circuit
   * This prevents retries from happening when circuit is open (fail fast)
   */
  getWrappedPolicy(name: string, customRetryConfig?: Partial<RetryConfig>): IPolicy {
    const existing = this.wrappedPolicies.get(name);
    if (existing) {
      return existing;
    }

    const circuitBreakerPolicy = this.getBreaker(name);
    const retryPolicy = this.createRetryPolicy(name, customRetryConfig);

    // Wrap: retry -> circuit breaker
    // When circuit is open, BrokenCircuitError is thrown immediately (no retries)
    const wrappedPolicy = wrap(retryPolicy, circuitBreakerPolicy);

    this.wrappedPolicies.set(name, wrappedPolicy);
    this.logger.log(`Wrapped policy [${name}] created with retry + circuit breaker`);

    return wrappedPolicy;
  }

  /**
   * Create a retry policy with exponential backoff and jitter
   */
  private createRetryPolicy(name: string, customConfig?: Partial<RetryConfig>) {
    const baseConfig = this.defaultRetryConfigs[name] || {
      maxAttempts: 3,
      initialDelay: 500,
      maxDelay: 5000,
    };
    const config: RetryConfig = { ...baseConfig, ...customConfig };

    const retryPolicy = retry(handleAll, {
      maxAttempts: config.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: config.initialDelay,
        maxDelay: config.maxDelay,
        exponent: config.exponent || 2,
      }),
    });

    // onRetry receives: { error: Error, delay: number, attempt: number }
    retryPolicy.onRetry((event) => {
      const errorMsg = 'error' in event ? event.error.message : 'Unknown error';
      const attemptNum = 'attempt' in event ? event.attempt : '?';
      this.logger.warn(`Retry [${name}] attempt ${attemptNum}/${config.maxAttempts}: ${errorMsg}`);
    });

    // onGiveUp receives: { error: Error } - no attempt property
    retryPolicy.onGiveUp((event) => {
      const errorMsg = 'error' in event ? event.error.message : 'Unknown error';
      this.logger.error(`Retry [${name}] exhausted ${config.maxAttempts} attempts: ${errorMsg}`);
    });

    return retryPolicy;
  }

  /**
   * Convenience getters for wrapped policies (retry + circuit breaker)
   */
  getBedrockWrapped(): IPolicy {
    return this.getWrappedPolicy('bedrock');
  }

  getTextractWrapped(): IPolicy {
    return this.getWrappedPolicy('textract');
  }

  getS3Wrapped(): IPolicy {
    return this.getWrappedPolicy('s3');
  }

  getDatabaseWrapped(): IPolicy {
    return this.getWrappedPolicy('database');
  }

  /**
   * Get status of all circuit breakers for health checks
   */
  getAllStatus(): CircuitBreakerStatus[] {
    const statuses: CircuitBreakerStatus[] = [];

    for (const [name, breaker] of this.breakers.entries()) {
      statuses.push({
        name,
        state: this.getStateName(breaker.state),
        failures: 0, // ConsecutiveBreaker doesn't expose count, but state tells us enough
      });
    }

    return statuses;
  }

  /**
   * Check if a specific breaker is open (failing fast)
   */
  isOpen(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (!breaker) return false;
    return breaker.state === CircuitState.Open;
  }

  /**
   * Check if any breaker is open
   */
  hasOpenCircuit(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.state === CircuitState.Open) {
        return true;
      }
    }
    return false;
  }

  /**
   * Convert CircuitState enum to readable string
   */
  private getStateName(state: CircuitState): 'closed' | 'open' | 'half-open' {
    switch (state) {
      case CircuitState.Closed:
        return 'closed';
      case CircuitState.Open:
        return 'open';
      case CircuitState.HalfOpen:
        return 'half-open';
      default:
        return 'closed';
    }
  }

  /**
   * Helper to check if an error is a BrokenCircuitError
   */
  static isBrokenCircuitError(error: unknown): error is BrokenCircuitError {
    return error instanceof BrokenCircuitError;
  }

  /**
   * Execute a function through the circuit breaker with queuing support
   * When circuit is open, request is enqueued instead of failing fast
   */
  async executeWithQueue<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    // Get the underlying breaker directly (not the wrapped proxy) to avoid infinite recursion
    // The proxy wrapper intercepts execute() and calls executeWithQueue, which would create a loop
    const breaker = this.breakers.get(name);
    if (!breaker) {
      // If breaker doesn't exist, create it (this will return wrapped version, but we'll get underlying below)
      this.getBreaker(name);
      const createdBreaker = this.breakers.get(name);
      if (!createdBreaker) {
        throw new Error(`Failed to create circuit breaker [${name}]`);
      }
      // Use the underlying breaker from the map
      return this.executeWithQueueInternal(createdBreaker, name, fn, metadata);
    }

    return this.executeWithQueueInternal(breaker, name, fn, metadata);
  }

  /**
   * Internal method that executes with the underlying breaker (not the proxy)
   */
  private async executeWithQueueInternal<T>(
    breaker: CircuitBreakerPolicy,
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const config = this.breakerConfigs.get(name) || { enableQueuing: true };

    // If queuing is disabled, use standard execute
    if (config.enableQueuing === false || !this.queueService) {
      return breaker.execute(fn);
    }

    // Check circuit state
    const state = breaker.state;

    if (state === CircuitState.Closed) {
      // Circuit is closed - execute normally
      return breaker.execute(fn);
    } else if (state === CircuitState.HalfOpen) {
      // Circuit is half-open - execute directly to test recovery
      return breaker.execute(fn);
    } else if (state === CircuitState.Open) {
      // Circuit is open - enqueue the request
      this.logger.debug(`Circuit breaker [${name}] is open, enqueuing request for later processing`);
      return this.queueService.enqueueRequest(name, fn, metadata);
    } else {
      // Unknown state - fallback to normal execute
      return breaker.execute(fn);
    }
  }

  /**
   * Handle half-open state transition - process pending queued requests
   */
  private async handleHalfOpenState(name: string): Promise<void> {
    if (!this.workerService || !this.queueService) {
      this.logger.debug(`Queue/worker services not available, skipping pending request processing for [${name}]`);
      return;
    }

    this.logger.log(`Circuit breaker [${name}] entered half-open state, processing pending requests`);

    try {
      // Get config to determine how many requests to test
      const config = this.breakerConfigs.get(name);
      const testLimit = config?.threshold || 3; // Test a few requests

      // Trigger processing of pending requests
      await this.workerService.processPendingRequests(name, testLimit);
    } catch (error) {
      this.logger.error(`Failed to process pending requests for circuit breaker [${name}]: ${error.message}`);
    }
  }
}
