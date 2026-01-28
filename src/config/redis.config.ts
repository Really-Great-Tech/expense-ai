import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedBullConfigurationFactory, BullRootModuleOptions } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { AppConfigType } from './app.config';
import { LoggerService } from '../tools/logger/logger.service';

const CONTEXT = 'RedisConfigService';

@Injectable()
export class RedisConfigService implements SharedBullConfigurationFactory {
  private readonly logger = new LoggerService();
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
          age: 10, // seconds - cleanup successful jobs after 10s
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24 hours
        },
      },
    };
  }

  /**
   * Create Redis connection for BullMQ (AWS ElastiCache)
   * BullMQ requires maxRetriesPerRequest: null
   * Supports both standard Redis (Dev/Staging) and Cluster mode (Production)
   */
  private createBullMQRedisConnection(): Redis {
    const { host: endpoint, port, clusterMode } = this.appConfig.redis;

    if (!endpoint) {
      throw new Error('REDIS_HOST is required');
    }

    if (clusterMode) {
      this.logger.log(`Creating BullMQ Redis Cluster connection to ${endpoint}:${port}`, CONTEXT);

      return new Redis.Cluster([{ host: endpoint, port }], {
        redisOptions: {
          maxRetriesPerRequest: null, // Required by BullMQ
          enableReadyCheck: false,
          connectTimeout: 10000,
        },
      }) as any; // BullMQ accepts Cluster as connection
    }

    this.logger.log(`Creating BullMQ Redis connection to ${endpoint}:${port}`, CONTEXT);

    return new Redis({
      host: endpoint,
      port,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 10000,
    });
  }
}
