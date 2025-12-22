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
   * Create Redis connection for BullMQ (AWS ElastiCache)
   * BullMQ requires maxRetriesPerRequest: null
   */
  private createBullMQRedisConnection(): Redis {
    const { host: endpoint, port } = this.appConfig.redis;

    if (!endpoint) {
      throw new Error('REDIS_HOST is required');
    }

    this.logger.log(`Creating BullMQ Redis connection to ${endpoint}:${port}`);

    return new Redis({
      host: endpoint,
      port,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 10000,
    });
  }
}
