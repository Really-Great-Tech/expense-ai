import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SharedBullConfigurationFactory, BullRootModuleOptions } from '@nestjs/bullmq';
import Redis, { Cluster, RedisOptions } from 'ioredis';

@Injectable()
export class RedisConfigService implements SharedBullConfigurationFactory {
  private readonly logger = new Logger(RedisConfigService.name);

  constructor(private configService: ConfigService) {}

  createSharedConfiguration(): BullRootModuleOptions {
    const redisHost = this.configService.get<string>('REDIS_HOST','localhost',);
    const redisPort = parseInt(this.configService.get<string>('REDIS_PORT', '6379'), 10);
    const useCluster = this.configService.get('REDIS_CLUSTER_ENABLED', 'true') === 'true';
    const useTls = this.configService.get('REDIS_TLS_ENABLED', 'true') === 'true';

    const connection = useCluster
      ? new Cluster(
          [
            {
              host: redisHost,
              port: redisPort,
            },
          ],
          {
            dnsLookup: (address, callback) => callback(null, address),
            redisOptions: this.buildRedisOptions(useTls, redisHost),
          },
        )
      : new Redis({
          host: redisHost,
          port: redisPort,
          ...this.buildRedisOptions(useTls, redisHost),
        } as RedisOptions);

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

  private buildRedisOptions(useTls: boolean, serverName: string): Partial<RedisOptions> {
    const options: Partial<RedisOptions> = {};

    if (useTls) {
      options.tls = {
        servername: serverName,
      };
      this.logger.log(`TLS enabled for Redis connection (servername: ${serverName})`);
    }

    const password = this.configService.get<string>('REDIS_PASSWORD');
    if (password) {
      options.password = password;
    }

    const username = this.configService.get<string>('REDIS_USERNAME');
    if (username) {
      options.username = username;
    }

    return options;
  }
}
