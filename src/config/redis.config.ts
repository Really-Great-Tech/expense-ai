import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedBullConfigurationFactory, BullRootModuleOptions } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { AppConfigType } from './app.config';

@Injectable()
export class RedisConfigService implements SharedBullConfigurationFactory {
  private readonly logger = new Logger(RedisConfigService.name);
  private readonly appConfig: AppConfigType;

  constructor(private configService: ConfigService) {
    // Get typed app config
    this.appConfig = this.configService.get<AppConfigType>('app')!;
  }

  createSharedConfiguration(): BullRootModuleOptions {
    const connection = this.createBullMQRedisConnection();

    return {
      connection,
      prefix: '{bull}', // force all BullMQ keys into same hash slot for cluster mode
      defaultJobOptions: {
        attempts: this.appConfig.workers.maxRetryAttempts,
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
    const redisMode = this.appConfig.redis.mode;

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
    const { host, port, password, db } = this.appConfig.redis;

    this.logger.log(`Creating local BullMQ Redis connection to ${host}:${port}`);

    return new Redis({
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });
  }

  /**
   * Create managed Redis connection for BullMQ (AWS ElastiCache)
   * BullMQ requires maxRetriesPerRequest: null
   */
  private createManagedBullMQRedisConnection(): Redis {
    const { host: endpoint, port, password, db, tlsEnabled } = this.appConfig.redis;

    if (!endpoint) {
      throw new Error('REDIS_HOST is required when REDIS_MODE=managed');
    }

    this.logger.log(`Creating managed BullMQ Redis connection to ${endpoint}:${port} (TLS: ${tlsEnabled})`);

    const config: any = {
      host: endpoint,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 10000,
    };

    if (tlsEnabled) {
      config.tls = {
        servername: endpoint,
        // Use default Node.js certificate validation
        // ElastiCache uses AWS-managed certificates validated against system CA store
        rejectUnauthorized: true,
      };
      this.logger.log(`TLS enabled for Redis connection (servername: ${endpoint})`);
    }

    return new Redis(config);
  }
}
