import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppConfigType } from '../config/app.config';

/**
 * Redis Health Indicator using simple PING
 *
 * Performs a lightweight health check by sending a PING command to Redis.
 * This is sufficient for health checks as it verifies:
 * - Network connectivity to Redis
 * - Redis server is responsive
 * - Authentication (if configured) is working
 */
@Injectable()
export class RedisHealthEnhancedIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthEnhancedIndicator.name);
  private readonly appConfig: AppConfigType;

  constructor(private configService: ConfigService) {
    super();
    this.appConfig = this.configService.get<AppConfigType>('app')!;
  }

  /**
   * Redis health check using PING command
   *
   * @param key - The key to use in the health check result
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @param _includeBullMQ - Ignored, kept for API compatibility
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isHealthy(key: string, timeoutMs = 5000, _includeBullMQ = true): Promise<HealthIndicatorResult> {
    const { host, port } = this.appConfig.redis;

    if (!host) {
      const result = this.getStatus(key, false, {
        message: 'REDIS_HOST is not configured',
      });
      throw new HealthCheckError('Redis health check failed', result);
    }

    let redis: Redis | null = null;

    try {
      redis = new Redis({
        host,
        port,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: timeoutMs,
        commandTimeout: timeoutMs,
        retryStrategy: () => null, // No retries for health check
      });

      // Suppress error logging for health checks
      redis.on('error', () => {});

      const startTime = Date.now();

      // Connect and ping with timeout
      await Promise.race([
        (async () => {
          await redis!.connect();
          await redis!.ping();
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Redis ping timeout after ${timeoutMs}ms`)), timeoutMs)),
      ]);

      const latency = Date.now() - startTime;

      await this.closeConnection(redis);

      this.logger.debug(`Redis health check passed: latency=${latency}ms`);

      return this.getStatus(key, true, {
        status: 'healthy',
        latency: `${latency}ms`,
      });
    } catch (error) {
      if (redis) {
        await this.closeConnection(redis);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Redis health check failed: ${errorMessage}`);

      const result = this.getStatus(key, false, {
        status: 'unhealthy',
        message: errorMessage,
      });

      throw new HealthCheckError('Redis health check failed', result);
    }
  }

  private async closeConnection(redis: Redis): Promise<void> {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }
}
