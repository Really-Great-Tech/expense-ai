import { Injectable, Logger } from '@nestjs/common';
import { bulkhead, BulkheadPolicy, BulkheadRejectedError } from 'cockatiel';
import { RetryableBulkheadTimeoutError } from '@/common/errors/service-errors';

export interface BulkheadConfig {
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum queued requests waiting for execution */
  maxQueue: number;
  /** Default timeout (ms) for executeWithTimeout - how long to wait for a slot */
  defaultTimeoutMs?: number;
}

export interface BulkheadStatus {
  name: string;
  executionSlots: number;
  queueSlots: number;
}

/**
 * Singleton instance for use in non-DI contexts (e.g., plain classes like TextractApiService)
 */
let globalBulkheadService: BulkheadService | null = null;

export function getGlobalBulkheadService(): BulkheadService {
  if (!globalBulkheadService) {
    globalBulkheadService = new BulkheadService();
  }
  return globalBulkheadService;
}

/**
 * Bulkhead Service
 *
 * Provides named bulkheads (concurrency limiters) for different external services.
 * Prevents overwhelming external services by limiting concurrent requests.
 *
 * Flow: Request -> Bulkhead (queue/reject) -> Circuit Breaker -> External Service
 */
@Injectable()
export class BulkheadService {
  private readonly logger = new Logger(BulkheadService.name);
  private readonly bulkheads = new Map<string, BulkheadPolicy>();
  private readonly bulkheadConfigs = new Map<string, BulkheadConfig>();

  /**
   * Pre-configured bulkhead configs for different service types
   * Based on typical rate limits and best practices
   */
  private readonly defaultConfigs: Record<string, BulkheadConfig> = {
    // Textract: Conservative limit to stay under AWS rate limits (~1-10 TPS)
    textract: { maxConcurrent: 5, maxQueue: 50, defaultTimeoutMs: 10000 },
    // Bedrock: Model-dependent, conservative default
    bedrock: { maxConcurrent: 10, maxQueue: 100, defaultTimeoutMs: 15000 },
    // S3: Very high throughput, generous limits
    s3: { maxConcurrent: 20, maxQueue: 200, defaultTimeoutMs: 5000 },
    // Database: Depends on connection pool
    database: { maxConcurrent: 15, maxQueue: 100, defaultTimeoutMs: 10000 },
  };

  /**
   * Get or create a bulkhead by name
   */
  getBulkhead(name: string, customConfig?: Partial<BulkheadConfig>): BulkheadPolicy {
    const existing = this.bulkheads.get(name);
    if (existing) {
      return existing;
    }

    const baseConfig = this.defaultConfigs[name] || { maxConcurrent: 10, maxQueue: 50 };
    const config: BulkheadConfig = { ...baseConfig, ...customConfig };

    const policy = bulkhead(config.maxConcurrent, config.maxQueue);

    // Log rejections (queue full)
    policy.onReject(() => {
      this.logger.warn(`Bulkhead [${name}] rejected request (queue full: ${config.maxQueue})`);
    });

    this.bulkheads.set(name, policy);
    this.bulkheadConfigs.set(name, config);

    this.logger.log(
      `Bulkhead [${name}] created: maxConcurrent=${config.maxConcurrent}, maxQueue=${config.maxQueue}`,
    );

    return policy;
  }

  /**
   * Convenience getters for common services
   */
  getTextractBulkhead(): BulkheadPolicy {
    return this.getBulkhead('textract');
  }

  getBedrockBulkhead(): BulkheadPolicy {
    return this.getBulkhead('bedrock');
  }

  getS3Bulkhead(): BulkheadPolicy {
    return this.getBulkhead('s3');
  }

  getDatabaseBulkhead(): BulkheadPolicy {
    return this.getBulkhead('database');
  }

  /**
   * Get status of all bulkheads for health checks
   */
  getAllStatus(): BulkheadStatus[] {
    const statuses: BulkheadStatus[] = [];

    for (const [name, _policy] of this.bulkheads.entries()) {
      const config = this.bulkheadConfigs.get(name);
      statuses.push({
        name,
        executionSlots: config?.maxConcurrent || 0,
        queueSlots: config?.maxQueue || 0,
      });
    }

    return statuses;
  }

  /**
   * Helper to check if an error is a BulkheadRejectedError
   */
  static isBulkheadRejectedError(error: unknown): error is BulkheadRejectedError {
    return error instanceof BulkheadRejectedError;
  }

  /**
   * Execute with timeout waiting for a bulkhead slot.
   *
   * Instead of immediately rejecting when the bulkhead is full,
   * this method polls for an available slot up to the specified timeout.
   *
   * Flow:
   * 1. Try to execute through bulkhead
   * 2. If rejected (queue full), wait and retry
   * 3. If timeout exceeded, throw RetryableBulkheadTimeoutError
   * 4. RetryableBulkheadTimeoutError → ServiceUnavailableError → Job retries after 35s
   *
   * @param name - Bulkhead name (e.g., 'bedrock', 'textract')
   * @param fn - Function to execute
   * @param timeoutMs - Max time to wait for a slot (defaults to config's defaultTimeoutMs)
   */
  async executeWithTimeout<T>(name: string, fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const config = this.bulkheadConfigs.get(name) || this.defaultConfigs[name];
    const timeout = timeoutMs ?? config?.defaultTimeoutMs ?? 15000;
    const bulkhead = this.getBulkhead(name);
    const startTime = Date.now();
    const pollIntervalMs = 100; // Check every 100ms

    while (true) {
      try {
        return await bulkhead.execute(fn);
      } catch (error) {
        if (!(error instanceof BulkheadRejectedError)) {
          throw error; // Not a bulkhead error, propagate
        }

        // Check if we've exceeded timeout
        const elapsed = Date.now() - startTime;
        if (elapsed >= timeout) {
          this.logger.warn(
            `Bulkhead [${name}] timeout after ${elapsed}ms waiting for slot (limit: ${timeout}ms)`,
          );
          throw new RetryableBulkheadTimeoutError(
            `${name} bulkhead timeout after ${elapsed}ms (limit: ${timeout}ms)`,
            name,
          );
        }

        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }
}
