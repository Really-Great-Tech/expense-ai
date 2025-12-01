import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedBullConfigurationFactory, BullRootModuleOptions } from '@nestjs/bullmq';
import Redis from 'ioredis';

@Injectable()
export class RedisConfigService implements SharedBullConfigurationFactory {
  private readonly logger = new Logger(RedisConfigService.name);

  constructor(private configService: ConfigService) {}

  createSharedConfiguration(): BullRootModuleOptions {
    const connection = this.createBullMQRedisConnection();

    return {
      connection,
      prefix: '{bull}', // force all BullMQ keys into same hash slot for cluster mode
      defaultJobOptions: {
        attempts: this.configService.get('MAX_RETRY_ATTEMPTS', 3),
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 10,
        },
        removeOnFail: {
          count: 5,
        },
      },
    };
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
    const host = this.configService.get('REDIS_HOST', 'localhost');
    const port = this.configService.get('REDIS_PORT', 6379);

    this.logger.log(`Creating local BullMQ Redis connection to ${host}:${port}`);

    return new Redis({
      host,
      port,
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

    this.logger.log(`Creating managed BullMQ Redis connection to ${endpoint}:${port} (TLS: ${tlsEnabled})`);

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
      this.logger.log(`TLS enabled for Redis connection (servername: ${endpoint})`);
    }

    return new Redis(config);
  }
}
