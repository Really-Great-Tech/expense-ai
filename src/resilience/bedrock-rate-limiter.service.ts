import { Injectable, Logger } from '@nestjs/common';
import { default as pLimit } from '@/tools/p-limit/limit';
import type { ProfileKey } from '@/services/bedrock/bedrock-llm';

/**
 * Type definition for p-limit instance with its properties
 */
export interface PLimitFunction {
  <T>(fn: () => Promise<T>): Promise<T>;
  activeCount: number;
  pendingCount: number;
  clearQueue: () => void;
  concurrency: number;
}

export interface RateLimiterConfig {
  /** Maximum concurrent requests allowed */
  concurrency: number;
}

export interface RateLimiterMetrics {
  /** Profile key (model name) */
  profile: ProfileKey;
  /** Number of currently active calls */
  activeCount: number;
  /** Number of calls waiting in queue */
  pendingCount: number;
  /** Maximum concurrent limit */
  limit: number;
}

/**
 * Singleton instance for use in non-DI contexts (e.g., BedrockLlmService)
 */
let globalRateLimiterService: BedrockRateLimiterService | null = null;

export function getGlobalRateLimiterService(): BedrockRateLimiterService {
  if (!globalRateLimiterService) {
    globalRateLimiterService = new BedrockRateLimiterService();
  }
  return globalRateLimiterService;
}

/**
 * Bedrock Rate Limiter Service
 *
 * Provides per-model rate limiting for Bedrock API calls using p-limit semaphore pattern.
 * Prevents hitting Bedrock rate limits by controlling concurrent requests per model profile.
 *
 * Key features:
 * - Per-model concurrency limits (SONNET_4: 5, NOVA_PRO: 10, NOVA_MICRO: 20)
 * - Automatic queuing when limit reached (calls wait, don't fail)
 * - Metrics for monitoring (activeCount, pendingCount)
 * - Works alongside circuit breaker for layered resilience
 *
 * Flow: Request → RateLimiter (wait if needed) → CircuitBreaker → AWS SDK → Bedrock
 */
@Injectable()
export class BedrockRateLimiterService {
  private readonly logger = new Logger(BedrockRateLimiterService.name);
  private readonly limiters = new Map<ProfileKey, PLimitFunction>();
  private readonly configs = new Map<ProfileKey, RateLimiterConfig>();

  /**
   * Default concurrency limits per model profile
   * Based on typical Bedrock quotas and model characteristics:
   * - SONNET models: Lower limit (expensive, slower)
   * - NOVA_PRO: Balanced limit
   * - NOVA_MICRO: Higher limit (cheaper, faster)
   */
  private readonly defaultLimits: Record<ProfileKey, number> = {
    SONNET_4: 5,
    SONNET_4_5: 5,
    NOVA_PRO: 10,
    NOVA_MICRO: 20,
  };

  constructor() {
    this.initializeLimiters();
    this.startPeriodicMetricsLogging();
  }

  /**
   * Initialize p-limit instances for each model profile
   */
  private initializeLimiters(): void {
    for (const [profileKey, limit] of Object.entries(this.defaultLimits)) {
      const limiter = pLimit(limit) as unknown as PLimitFunction;
      this.limiters.set(profileKey as ProfileKey, limiter);
      this.configs.set(profileKey as ProfileKey, { concurrency: limit });

      this.logger.log(
        `Rate limiter initialized for ${profileKey}: concurrency=${limit}`,
      );
    }

    this.logger.log('All Bedrock rate limiters initialized');
  }

  /**
   * Execute a function with rate limiting for the specified profile
   * If at capacity, the call will wait in queue until a slot is available
   *
   * @param profileKey The model profile key (SONNET_4, NOVA_PRO, etc.)
   * @param fn The async function to execute (typically a Bedrock API call)
   * @returns Promise that resolves with the function's return value
   * @throws Error if profile not found or function execution fails
   */
  async executeWithLimit<T>(
    profileKey: ProfileKey,
    fn: () => Promise<T>,
  ): Promise<T> {
    const limiter = this.limiters.get(profileKey);

    if (!limiter) {
      throw new Error(
        `No rate limiter configured for profile: ${profileKey}. Available profiles: ${Array.from(this.limiters.keys()).join(', ')}`,
      );
    }

    const metrics = this.getMetrics(profileKey);
    
    // Log if we're at capacity (call will wait)
    if (metrics.activeCount >= metrics.limit) {
      this.logger.log(
        `⚠️  RATE LIMIT REACHED for ${profileKey}: ${metrics.activeCount}/${metrics.limit} active, ${metrics.pendingCount} waiting in queue`,
      );
    }

    // Execute with rate limiting - will wait here if at capacity
    return limiter(fn);
  }

  /**
   * Get current metrics for a specific profile
   *
   * @param profileKey The model profile key
   * @returns Metrics object with active, pending, and limit counts
   * @throws Error if profile not found
   */
  getMetrics(profileKey: ProfileKey): RateLimiterMetrics {
    const limiter = this.limiters.get(profileKey);
    const config = this.configs.get(profileKey);

    if (!limiter || !config) {
      throw new Error(`No rate limiter found for profile: ${profileKey}`);
    }

    return {
      profile: profileKey,
      activeCount: limiter.activeCount,
      pendingCount: limiter.pendingCount,
      limit: config.concurrency,
    };
  }

  /**
   * Get metrics for all configured profiles
   *
   * @returns Array of metrics for all profiles
   */
  getAllMetrics(): RateLimiterMetrics[] {
    const metrics: RateLimiterMetrics[] = [];

    for (const profileKey of this.limiters.keys()) {
      metrics.push(this.getMetrics(profileKey));
    }

    return metrics;
  }

  /**
   * Update concurrency limit for a specific profile
   * Useful for dynamic adjustment based on observed performance
   *
   * @param profileKey The model profile key
   * @param newLimit New concurrency limit
   */
  updateLimit(profileKey: ProfileKey, newLimit: number): void {
    const limiter = this.limiters.get(profileKey);

    if (!limiter) {
      throw new Error(`No rate limiter found for profile: ${profileKey}`);
    }

    // Update the limiter's concurrency
    limiter.concurrency = newLimit;

    // Update stored config
    this.configs.set(profileKey, { concurrency: newLimit });

    this.logger.log(
      `Rate limiter for ${profileKey} updated: concurrency=${newLimit}`,
    );
  }

  /**
   * Check if any profile is currently at capacity
   *
   * @returns True if any limiter has pending requests
   */
  hasQueuedRequests(): boolean {
    for (const limiter of this.limiters.values()) {
      if (limiter.pendingCount > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get total active requests across all profiles
   *
   * @returns Total number of active Bedrock calls
   */
  getTotalActiveCount(): number {
    let total = 0;
    for (const limiter of this.limiters.values()) {
      total += limiter.activeCount;
    }
    return total;
  }

  /**
   * Get total pending requests across all profiles
   *
   * @returns Total number of queued Bedrock calls
   */
  getTotalPendingCount(): number {
    let total = 0;
    for (const limiter of this.limiters.values()) {
      total += limiter.pendingCount;
    }
    return total;
  }

  /**
   * Clear all pending requests in all queues
   * WARNING: This will cause pending promises to never resolve
   * Use only in emergency situations or shutdown
   */
  clearAllQueues(): void {
    this.logger.warn('Clearing all rate limiter queues');
    for (const limiter of this.limiters.values()) {
      limiter.clearQueue();
    }
  }

  /**
   * Start periodic logging of rate limiter metrics
   * Logs metrics every 30 seconds to console for monitoring
   */
  private startPeriodicMetricsLogging(): void {
    // Log metrics every 30 seconds
    setInterval(() => {
      const totalActive = this.getTotalActiveCount();
      const totalPending = this.getTotalPendingCount();
      
      // Only log if there's activity
      if (totalActive > 0 || totalPending > 0) {
        this.logger.log(
          `📊 Rate Limiter Status: ${totalActive} active, ${totalPending} pending across all models`,
        );
        
        // Log per-model breakdown
        const allMetrics = this.getAllMetrics();
        allMetrics.forEach(m => {
          if (m.activeCount > 0 || m.pendingCount > 0) {
            const utilization = Math.round((m.activeCount / m.limit) * 100);
            this.logger.log(
              `   ${m.profile}: ${m.activeCount}/${m.limit} active (${utilization}%), ${m.pendingCount} waiting`,
            );
          }
        });
      }
    }, 30000); // 30 seconds
  }
}
