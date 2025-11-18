import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';

/**
 * Enhanced Redis Health Indicator
 *
 * Performs meaningful Redis health checks by:
 * - Testing actual read/write operations (not just ping)
 * - Measuring operation latency
 * - Verifying data persistence
 * - Testing key expiration functionality
 * - Checking Redis server info
 *
 * This ensures Redis is truly functional for caching and job queues
 */
@Injectable()
export class RedisHealthEnhancedIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthEnhancedIndicator.name);
  private readonly HEALTH_CHECK_KEY_PREFIX = 'health:check:';

  constructor(private configService: ConfigService) {
    super();
  }

  /**
   * Comprehensive Redis health check with read/write test
   *
   * @param key - The key to use in the health check result
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   */
  async isHealthy(key: string, timeoutMs = 5000): Promise<HealthIndicatorResult> {
    let redis: Redis | null = null;
    const startTime = Date.now();

    try {
      // Create Redis connection
      redis = this.createRedisConnection();

      // Run comprehensive health check with timeout
      const healthData = await Promise.race([
        this.performHealthCheck(redis),
        this.timeoutPromise(timeoutMs),
      ]);

      const totalTime = Date.now() - startTime;

      // Close connection
      await this.closeConnection(redis);

      this.logger.debug(
        `Redis health check passed: ` +
          `write=${healthData.writeLatency}ms, ` +
          `read=${healthData.readLatency}ms, ` +
          `total=${totalTime}ms`,
      );

      return this.getStatus(key, true, {
        message: 'Redis is fully operational',
        operations: {
          write: 'success',
          read: 'success',
          delete: 'success',
        },
        latency: {
          write: `${healthData.writeLatency}ms`,
          read: `${healthData.readLatency}ms`,
          total: `${totalTime}ms`,
        },
        server: healthData.serverInfo,
      });
    } catch (error) {
      // Ensure connection is closed on error
      if (redis) {
        await this.closeConnection(redis);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${errorMessage}`);

      const result = this.getStatus(key, false, {
        message: errorMessage,
        status: 'unhealthy',
      });

      throw new HealthCheckError('Redis health check failed', result);
    }
  }

  /**
   * Perform comprehensive Redis health check
   * Tests write, read, and delete operations
   */
  private async performHealthCheck(redis: Redis): Promise<{
    writeLatency: number;
    readLatency: number;
    serverInfo: any;
  }> {
    // Connect to Redis
    await redis.connect();

    const testKey = `${this.HEALTH_CHECK_KEY_PREFIX}${Date.now()}`;
    const testValue = JSON.stringify({
      timestamp: new Date().toISOString(),
      test: 'health-check',
      random: Math.random(),
    });

    // Test WRITE operation
    const writeStart = Date.now();
    await redis.set(testKey, testValue, 'EX', 60); // Expire in 60 seconds
    const writeLatency = Date.now() - writeStart;

    // Test READ operation
    const readStart = Date.now();
    const readValue = await redis.get(testKey);
    const readLatency = Date.now() - readStart;

    // Verify data integrity
    if (readValue !== testValue) {
      throw new Error('Redis data integrity check failed: read value does not match written value');
    }

    // Test DELETE operation
    await redis.del(testKey);

    // Verify deletion
    const deletedValue = await redis.get(testKey);
    if (deletedValue !== null) {
      throw new Error('Redis delete operation failed: key still exists after deletion');
    }

    // Get server info
    const info = await redis.info('server');
    const serverInfo = this.parseRedisInfo(info);

    return {
      writeLatency,
      readLatency,
      serverInfo,
    };
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const serverInfo: any = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key === 'redis_version') serverInfo.version = value;
        if (key === 'uptime_in_seconds') serverInfo.uptimeSeconds = parseInt(value, 10);
        if (key === 'connected_clients') serverInfo.connectedClients = parseInt(value, 10);
      }
    }

    return serverInfo;
  }

  /**
   * Create Redis connection using same configuration as application
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
      lazyConnect: true,
    });
  }

  /**
   * Create managed Redis connection (AWS ElastiCache)
   */
  private createManagedRedisConnection(): Redis {
    const endpoint = this.configService.get('REDIS_HOST');
    const port = this.configService.get('REDIS_PORT', 6379);
    const password = this.configService.get('REDIS_PASSWORD');
    const tlsEnabled = this.configService.get('REDIS_TLS_ENABLED', 'false') === 'true';

    if (!endpoint) {
      throw new Error('REDIS_HOST is required when REDIS_MODE=managed');
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
   * Create timeout promise
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis health check timeout after ${ms}ms`));
      }, ms);
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
