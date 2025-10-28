import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';

/**
 * Redis Health Indicator
 *
 * Monitors Redis connectivity for the BullMQ job queue.
 * Based on Vendure's implementation with timeout handling.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    super();
  }

  /**
   * Check if Redis is healthy
   * @param key - The key to use in the health check result
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   */
  async isHealthy(key: string, timeoutMs = 5000): Promise<HealthIndicatorResult> {
    let redis: Redis | null = null;

    try {
      // Create Redis connection using same config as BullMQ
      redis = this.createRedisConnection();

      // Ping Redis with timeout
      const pingResult = await this.pingWithTimeout(redis, timeoutMs);

      // Close connection
      await this.closeConnection(redis);

      if (pingResult === 'PONG') {
        const result = this.getStatus(key, true, { message: 'Redis is reachable' });
        this.logger.debug(`Redis health check passed: ${key}`);
        return result;
      }

      throw new Error('Redis ping failed');
    } catch (error) {
      // Ensure connection is closed on error
      if (redis) {
        await this.closeConnection(redis);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${errorMessage}`);

      const result = this.getStatus(key, false, { message: errorMessage });
      throw new HealthCheckError('Redis health check failed', result);
    }
  }

  /**
   * Create Redis connection using same configuration as BullMQ
   */
  private createRedisConnection(): Redis {
    const redisMode = this.configService.get('REDIS_MODE', 'local');

    if (redisMode === 'managed') {
      return this.createManagedRedisConnection();
    }

    return this.createLocalRedisConnection();
  }

  /**
   * Create local Redis connection
   */
  private createLocalRedisConnection(): Redis {
    return new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true, // Don't auto-connect, we'll connect explicitly
    });
  }

  /**
   * Create managed Redis connection (AWS ElastiCache)
   */
  private createManagedRedisConnection(): Redis {
    const endpoint = this.configService.get('REDIS_ENDPOINT');
    const port = this.configService.get('REDIS_PORT', 6379);
    const password = this.configService.get('REDIS_PASSWORD');
    const tlsEnabled = this.configService.get('REDIS_TLS_ENABLED', 'false') === 'true';

    if (!endpoint) {
      throw new Error('REDIS_ENDPOINT is required when REDIS_MODE=managed');
    }

    const config: any = {
      host: endpoint,
      port: parseInt(port.toString(), 10),
      password: password || undefined,
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 10000,
    };

    if (tlsEnabled) {
      config.tls = {
        servername: endpoint,
        checkServerIdentity: () => undefined,
      };
    }

    return new Redis(config);
  }

  /**
   * Ping Redis with timeout
   */
  private async pingWithTimeout(redis: Redis, timeoutMs: number): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      // Set timeout
      this.timeoutTimer = setTimeout(() => {
        reject(new Error(`Redis health check timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        // Connect to Redis
        await redis.connect();

        // Ping Redis
        const result = await redis.ping();

        // Clear timeout
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }

        resolve(result);
      } catch (error) {
        // Clear timeout
        if (this.timeoutTimer) {
          clearTimeout(this.timeoutTimer);
          this.timeoutTimer = null;
        }

        reject(error);
      }
    });
  }

  /**
   * Close Redis connection gracefully
   */
  private async closeConnection(redis: Redis): Promise<void> {
    try {
      await redis.quit();
    } catch (error) {
      // If quit fails, force disconnect
      redis.disconnect();
    }
  }
}
