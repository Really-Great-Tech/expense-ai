import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModuleOptions, BullOptionsFactory, SharedBullConfigurationFactory, BullRootModuleOptions } from '@nestjs/bull';
import IORedis from 'ioredis';

@Injectable()
export class RedisConfigService implements BullOptionsFactory, SharedBullConfigurationFactory {
  private readonly logger = new Logger(RedisConfigService.name);

  constructor(private configService: ConfigService) {}

  createBullOptions(): BullModuleOptions {
    const redisConfig = this.createRedisConfiguration();

    return {
      redis: redisConfig,
      // Rate limiting: Prevents queue overload by limiting job processing rate
      limiter: {
        max: 100, // Maximum number of jobs processed per duration window
        duration: 1000, // Duration window in milliseconds (1 second)
      },
      defaultJobOptions: {
        attempts: this.configService.get('MAX_RETRY_ATTEMPTS', 3),
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Keep last N completed/failed jobs for debugging (uses newer Bull format)
        removeOnComplete: {
          count: 10,
        },
        removeOnFail: {
          count: 5,
        },
      },
    };
  }

  createSharedConfiguration(): BullRootModuleOptions {
    return this.createBullOptions();
  }

  private createRedisConfiguration(): any {
    const redisMode = this.configService.get('REDIS_MODE', 'local');

    if (redisMode === 'managed') {
      return this.createManagedRedisConfiguration();
    }

    return this.createLocalRedisConfiguration();
  }

  private createLocalRedisConfiguration(): any {
    this.logger.log('Configuring Redis for local development');

    return {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: this.configService.get('REDIS_MAX_RETRIES_PER_REQUEST', 3),
      enableReadyCheck: this.configService.get('REDIS_ENABLE_READY_CHECK', 'false') === 'true',
    };
  }

  private createManagedRedisConfiguration(): any {
    this.logger.log('Configuring Redis for AWS ElastiCache');

    const clusterEnabled = this.configService.get('REDIS_CLUSTER_ENABLED', 'false') === 'true';

    if (clusterEnabled) {
      return this.createClusterConfiguration();
    }

    return this.createStandaloneElastiCacheConfiguration();
  }

  private createStandaloneElastiCacheConfiguration(): any {
    const tlsEnabled = this.configService.get('REDIS_TLS_ENABLED', 'true') === 'true';
    const endpoint = this.configService.get('REDIS_HOST');
    const port = parseInt(this.configService.get('REDIS_PORT', '6379'), 10);
    const username = this.configService.get('REDIS_USERNAME'); // Optional: Only needed if ACL is enabled
    const password = this.configService.get('REDIS_PASSWORD');

    if (!endpoint) {
      throw new Error('REDIS_HOST is required when REDIS_MODE=managed');
    }

    if (!password) {
      this.logger.warn('REDIS_PASSWORD is not set. ElastiCache requires authentication.');
    }

    const config: any = {
      host: endpoint,
      port,
      password,
      // lazyConnect: Delays connection until first command, useful for graceful startup
      lazyConnect: this.configService.get('REDIS_LAZY_CONNECT', 'true') === 'true',
      // keepAlive: Sends periodic packets to keep TCP connection alive (prevents timeout)
      keepAlive: parseInt(this.configService.get('REDIS_KEEP_ALIVE_MS', '60000'), 10),
      connectTimeout: parseInt(this.configService.get('REDIS_CONNECTION_TIMEOUT_MS', '10000'), 10),
      commandTimeout: parseInt(this.configService.get('REDIS_COMMAND_TIMEOUT_MS', '5000'), 10),
      // Custom retry strategy with exponential backoff
      retryStrategy: (times: number) => {
        const baseDelay = parseInt(this.configService.get('REDIS_RETRY_BASE_DELAY_MS', '1000'), 10);
        const maxDelay = parseInt(this.configService.get('REDIS_RETRY_MAX_DELAY_MS', '30000'), 10);
        const maxTotalRetries = parseInt(this.configService.get('REDIS_MAX_TOTAL_RETRIES', '10'), 10);

        if (times > maxTotalRetries) {
          this.logger.error(`Redis connection failed after ${times} attempts`);
          return null; // Stop retrying
        }

        const delay = Math.min(baseDelay * Math.pow(2, times), maxDelay);
        this.logger.warn(`Redis connection attempt ${times} failed. Retrying in ${delay}ms...`);
        return delay;
      },
      // reconnectOnError: Automatically reconnect on failover (replica promoted to master)
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          this.logger.warn('Redis replica promoted to master. Reconnecting...');
          return true; // Reconnect on failover
        }
        return false;
      },
      enableReadyCheck: this.configService.get('REDIS_ENABLE_READY_CHECK', 'false') === 'true',
      maxRetriesPerRequest: parseInt(this.configService.get('REDIS_MAX_RETRIES_PER_REQUEST', '3'), 10),
    };

    // Add username only if provided (ACL support)
    if (username) {
      config.username = username;
    }

    // Configure TLS for ElastiCache (encryption in-transit)
    if (tlsEnabled) {
      // servername MUST match the ElastiCache endpoint exactly to avoid SNI mismatch
      const tlsServername = this.configService.get('REDIS_TLS_SERVERNAME', endpoint);
      config.tls = {
        servername: tlsServername,
        rejectUnauthorized: this.configService.get('REDIS_TLS_REJECT_UNAUTHORIZED', 'true') === 'true',
      };
      this.logger.log(`TLS enabled for ElastiCache connection (servername: ${tlsServername})`);
    }

    return config;
  }

  private createClusterConfiguration(): any {
    this.logger.log('Configuring Redis Cluster for ElastiCache (Cluster Mode Enabled)');

    const tlsEnabled = this.configService.get('REDIS_TLS_ENABLED', 'true') === 'true';
    // Use configuration endpoint for automatic node discovery
    // Format: my-cluster.xxxx.clustercfg.use1.cache.amazonaws.com
    const clusterEndpoint = this.configService.get('REDIS_HOST');
    const port = parseInt(this.configService.get('REDIS_PORT', '6379'), 10);
    const username = this.configService.get('REDIS_USERNAME'); // Optional: Only needed if ACL is enabled
    const password = this.configService.get('REDIS_PASSWORD');

    if (!clusterEndpoint) {
      throw new Error('REDIS_HOST is required when REDIS_CLUSTER_ENABLED=true');
    }

    // Configuration endpoint auto-discovers all cluster nodes
    const nodes = [{ host: clusterEndpoint, port }];

    // Common Redis options for all cluster nodes
    const redisOptions: any = {
      password,
      // lazyConnect: Delays connection until first command
      lazyConnect: this.configService.get('REDIS_LAZY_CONNECT', 'true') === 'true',
      // keepAlive: Sends periodic packets to keep TCP connection alive
      keepAlive: parseInt(this.configService.get('REDIS_KEEP_ALIVE_MS', '60000'), 10),
      connectTimeout: parseInt(this.configService.get('REDIS_CONNECTION_TIMEOUT_MS', '10000'), 10),
      commandTimeout: parseInt(this.configService.get('REDIS_COMMAND_TIMEOUT_MS', '5000'), 10),
      enableReadyCheck: this.configService.get('REDIS_ENABLE_READY_CHECK', 'false') === 'true',
      maxRetriesPerRequest: parseInt(this.configService.get('REDIS_MAX_RETRIES_PER_REQUEST', '3'), 10),
    };

    // Add username only if provided (ACL support)
    if (username) {
      redisOptions.username = username;
    }

    // Configure TLS for cluster (encryption in-transit)
    if (tlsEnabled) {
      redisOptions.tls = {
        rejectUnauthorized: this.configService.get('REDIS_TLS_REJECT_UNAUTHORIZED', 'true') === 'true',
      };
      this.logger.log('TLS enabled for ElastiCache cluster connection');
    }

    // Return createClient factory - required by Bull for cluster mode
    return {
      // CRITICAL: prefix with hash tag ensures all Bull keys for a job hash to the same slot
      // This prevents CROSSSLOT errors in Redis Cluster
      prefix: '{bull}',
      createClient: (type: string) => {
        const cluster = new IORedis.Cluster(nodes, {
          // scaleReads: Distributes read commands across replicas for load balancing
          // Options: 'master' (all reads to master), 'slave' (all to replicas), 'all' (balanced)
          scaleReads: this.configService.get('REDIS_CLUSTER_SCALE_READS', 'slave') as 'master' | 'slave' | 'all',
          slotsRefreshTimeout: parseInt(this.configService.get('REDIS_CLUSTER_SLOTS_REFRESH_TIMEOUT_MS', '1000'), 10),
          slotsRefreshInterval: parseInt(this.configService.get('REDIS_CLUSTER_SLOTS_REFRESH_INTERVAL_MS', '1000'), 10),
          maxRedirections: parseInt(this.configService.get('REDIS_CLUSTER_MAX_REDIRECTS', '16'), 10),
          redisOptions,
        });

        // Optimize subscriber connections (Bull uses separate clients for pub/sub)
        if (type !== 'client') {
          (cluster.options as any).enableReadyCheck = false;
          (cluster.options as any).maxRetriesPerRequest = null;
        }

        return cluster;
      },
    };
  }
}
