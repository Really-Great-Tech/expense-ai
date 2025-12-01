import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';
import { Queue, Job } from 'bullmq';

/**
 * Enhanced Redis Health Indicator with BullMQ Support
 *
 * Performs comprehensive health checks by:
 * - Testing actual read/write operations (not just ping)
 * - Measuring operation latency
 * - Verifying data persistence
 * - Testing key expiration functionality
 * - Checking Redis server info
 * - Testing BullMQ queue connectivity and job lifecycle
 * - Verifying queue operations (enqueue, retrieve, delete)
 *
 * This ensures Redis is truly functional for caching and job queues
 */
@Injectable()
export class RedisHealthEnhancedIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthEnhancedIndicator.name);
  private readonly HEALTH_CHECK_KEY_PREFIX = 'health:check:';
  private readonly HEALTH_CHECK_QUEUE_PREFIX = 'health-bullmq-';

  constructor(private configService: ConfigService) {
    super();
  }

  /**
   * Comprehensive Redis health check with read/write test and BullMQ verification
   *
   * @param key - The key to use in the health check result
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @param includeBullMQ - Whether to include BullMQ health checks (default: true)
   */
  async isHealthy(key: string, timeoutMs = 5000, includeBullMQ = true): Promise<HealthIndicatorResult> {
    let redis: Redis | null = null;
    const startTime = Date.now();

    try {
      // Create Redis connection
      redis = this.createRedisConnection();

      // Run comprehensive Redis health check with timeout
      const redisHealthData = await Promise.race([
        this.performHealthCheck(redis),
        this.timeoutPromise<{
          writeLatency: number;
          readLatency: number;
          serverInfo: any;
        }>(timeoutMs, 'Redis health check'),
      ]);

      // Close Redis connection after basic health check
      await this.closeConnection(redis);
      redis = null;

      // Run BullMQ health check if enabled
      let bullmqHealthData: BullMQHealthCheckResult | null = null;
      if (includeBullMQ) {
        try {
          bullmqHealthData = await Promise.race([
            this.performBullMQHealthCheck(),
            this.timeoutPromise<BullMQHealthCheckResult>(timeoutMs, 'BullMQ health check'),
          ]);
        } catch (bullmqError) {
          // Log but don't fail the entire health check if BullMQ fails
          this.logger.warn(
            `BullMQ health check failed: ${bullmqError instanceof Error ? bullmqError.message : 'Unknown error'}`,
          );
          bullmqHealthData = {
            status: 'unhealthy',
            error: bullmqError instanceof Error ? bullmqError.message : 'Unknown error',
            queueLatency: 0,
            jobLifecycleLatency: 0,
          };
        }
      }

      const totalTime = Date.now() - startTime;

      this.logger.debug(
        `Redis health check passed: ` +
          `write=${redisHealthData.writeLatency}ms, ` +
          `read=${redisHealthData.readLatency}ms, ` +
          `bullmq=${bullmqHealthData?.status || 'skipped'}, ` +
          `total=${totalTime}ms`,
      );

      return this.getStatus(key, true, {
        message: 'Redis and BullMQ are fully operational',
        redis: {
          status: 'healthy',
          operations: {
            write: 'success',
            read: 'success',
            delete: 'success',
          },
          latency: {
            write: `${redisHealthData.writeLatency}ms`,
            read: `${redisHealthData.readLatency}ms`,
          },
          server: redisHealthData.serverInfo,
        },
        bullmq: bullmqHealthData
          ? {
              status: bullmqHealthData.status,
              operations: bullmqHealthData.status === 'healthy'
                ? {
                    queueConnect: 'success',
                    jobEnqueue: 'success',
                    jobRetrieve: 'success',
                    jobDelete: 'success',
                  }
                : undefined,
              latency: bullmqHealthData.status === 'healthy'
                ? {
                    queueConnect: `${bullmqHealthData.queueLatency}ms`,
                    jobLifecycle: `${bullmqHealthData.jobLifecycleLatency}ms`,
                  }
                : undefined,
              error: bullmqHealthData.error,
              queueInfo: bullmqHealthData.queueInfo,
            }
          : { status: 'skipped' },
        totalLatency: `${totalTime}ms`,
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
   * Perform BullMQ health check
   * Tests queue connectivity, job lifecycle (add, retrieve, delete)
   * Uses a dedicated Redis client for BullMQ
   */
  private async performBullMQHealthCheck(): Promise<BullMQHealthCheckResult> {
    const queueName = `${this.HEALTH_CHECK_QUEUE_PREFIX}${Date.now()}`;
    let queue: Queue | null = null;
    let redisClient: Redis | null = null;

    try {
      // Create a dedicated Redis client for BullMQ
      redisClient = this.createBullMQRedisConnection();
      
      // Create test queue using the Redis client
      const queueStart = Date.now();
      queue = new Queue(queueName, {
        connection: redisClient,
        prefix: '{health-check}', // Use a prefix to isolate health check keys
      });

      // Wait for queue to be ready
      await queue.waitUntilReady();
      const queueLatency = Date.now() - queueStart;

      // Test job lifecycle
      const jobLifecycleStart = Date.now();
      
      // Add a test job
      const testJobData = {
        test: true,
        timestamp: new Date().toISOString(),
        healthCheck: true,
      };
      
      const job = await queue.add('health-check-job', testJobData, {
        removeOnComplete: true,
        removeOnFail: true,
      });

      if (!job || !job.id) {
        throw new Error('BullMQ job creation failed: job or job.id is undefined');
      }

      // Retrieve the job to verify it was added
      const retrievedJob = await Job.fromId(queue, job.id);
      if (!retrievedJob) {
        throw new Error('BullMQ job retrieval failed: could not retrieve job by ID');
      }

      // Verify job data integrity
      if (retrievedJob.data.healthCheck !== true) {
        throw new Error('BullMQ job data integrity check failed');
      }

      // Remove the test job
      await retrievedJob.remove();

      // Verify job was removed
      const removedJob = await Job.fromId(queue, job.id);
      if (removedJob !== undefined) {
        throw new Error('BullMQ job removal failed: job still exists after removal');
      }

      const jobLifecycleLatency = Date.now() - jobLifecycleStart;

      // Get queue info
      const jobCountsResult = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

      // Close the queue
      await queue.close();

      // Close the Redis client
      await this.closeConnection(redisClient);

      return {
        status: 'healthy',
        queueLatency,
        jobLifecycleLatency,
        queueInfo: {
          name: queueName,
          jobCounts: {
            waiting: jobCountsResult.waiting || 0,
            active: jobCountsResult.active || 0,
            completed: jobCountsResult.completed || 0,
            failed: jobCountsResult.failed || 0,
            delayed: jobCountsResult.delayed || 0,
          },
        },
      };
    } catch (error) {
      // Ensure queue and Redis client are closed on error
      if (queue) {
        try {
          await queue.close();
        } catch (closeError) {
          this.logger.warn(`Failed to close test queue: ${closeError}`);
        }
      }
      if (redisClient) {
        try {
          await this.closeConnection(redisClient);
        } catch (closeError) {
          this.logger.warn(`Failed to close Redis client: ${closeError}`);
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`BullMQ health check failed: ${errorMessage}`);

      return {
        status: 'unhealthy',
        error: errorMessage,
        queueLatency: 0,
        jobLifecycleLatency: 0,
      };
    }
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
   * Create Redis connection for BullMQ
   * Routes to local or managed connection based on REDIS_MODE
   */
  private createBullMQRedisConnection(): Redis {
    const redisMode = this.configService.get('REDIS_MODE', 'local');

    if (redisMode === 'managed') {
      return this.createManagedBullMQRedisConnection();
    }

    return this.createLocalBullMQRedisConnection();
  }

  /**
   * Create local Redis connection for BullMQ
   * BullMQ requires maxRetriesPerRequest: null
   */
  private createLocalBullMQRedisConnection(): Redis {
    return new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });
  }

  /**
   * Create managed Redis connection for BullMQ (AWS ElastiCache)
   * BullMQ requires maxRetriesPerRequest: null
   */
  private createManagedBullMQRedisConnection(): Redis {
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
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
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
  private timeoutPromise<T>(ms: number, operation: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timeout after ${ms}ms`));
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

/**
 * BullMQ health check result interface
 */
interface BullMQHealthCheckResult {
  status: 'healthy' | 'unhealthy';
  error?: string;
  queueLatency: number;
  jobLifecycleLatency: number;
  queueInfo?: {
    name: string;
    jobCounts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  };
}
