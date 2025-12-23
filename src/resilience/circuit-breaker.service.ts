import { Injectable, Logger } from '@nestjs/common';
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

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  threshold: number;
  /** Time in ms to wait before trying half-open */
  halfOpenAfter: number;
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
   */
  getBreaker(name: string, customConfig?: Partial<CircuitBreakerConfig>): CircuitBreakerPolicy {
    const existing = this.breakers.get(name);
    if (existing) {
      return existing;
    }

    const baseConfig = this.defaultConfigs[name] || { threshold: 3, halfOpenAfter: 15_000 };
    const config: CircuitBreakerConfig = { ...baseConfig, ...customConfig };

    const policy = circuitBreaker(handleAll, {
      halfOpenAfter: config.halfOpenAfter,
      breaker: new ConsecutiveBreaker(config.threshold),
    });

    // Log state changes
    policy.onStateChange((state) => {
      const stateName = this.getStateName(state);
      this.logger.warn(`Circuit breaker [${name}] state changed to: ${stateName}`);
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

    this.logger.log(
      `Circuit breaker [${name}] created: threshold=${config.threshold}, halfOpenAfter=${config.halfOpenAfter}ms`,
    );

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
}
