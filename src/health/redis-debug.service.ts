import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster } from 'ioredis';
import { Queue } from 'bullmq';

interface DebugStep {
  step: number;
  name: string;
  status: 'success' | 'failed' | 'skipped';
  duration_ms: number;
  details?: any;
  error?: string;
}

interface RedisDebugResult {
  mode: 'standalone' | 'cluster';
  overall_status: 'success' | 'failed';
  steps: DebugStep[];
  total_duration_ms: number;
  recommendation?: string;
}

interface BullQueueDebugResult {
  config_name: string;
  description: string;
  overall_status: 'success' | 'failed';
  steps: DebugStep[];
  total_duration_ms: number;
  job_id?: string;
  config_details: any;
  recommendation?: string;
}

export interface FullDebugReport {
  timestamp: string;
  environment: {
    REDIS_MODE: string;
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_CLUSTER_ENABLED: string;
    REDIS_TLS_ENABLED: string;
    REDIS_LAZY_CONNECT: string;
  };
  current_config_analysis: string;
  standalone_redis_test: RedisDebugResult;
  cluster_redis_test: RedisDebugResult;
  bull_config_tests: BullQueueDebugResult[];
  diagnosis: {
    working_modes: string[];
    failing_modes: string[];
    working_bull_configs: string[];
    root_cause: string;
    recommended_fix: string;
    recommended_bull_config?: any;
  };
}

@Injectable()
export class RedisDebugService {
  private readonly logger = new Logger(RedisDebugService.name);

  constructor(private configService: ConfigService) {}

  async runFullDiagnostic(): Promise<FullDebugReport> {
    this.logger.log('🔍 Starting full Redis/Bull diagnostic...');

    const startTime = Date.now();
    const OVERALL_TIMEOUT = 120000; // 2 minute max for entire diagnostic
    const REDIS_TEST_TIMEOUT = 20000; // 20s per Redis test
    const BULL_TEST_TIMEOUT = 25000; // 25s per Bull test

    // Get environment config
    const environment = {
      REDIS_MODE: this.configService.get('REDIS_MODE', 'local'),
      REDIS_HOST: this.maskSensitive(this.configService.get('REDIS_HOST', 'localhost')),
      REDIS_PORT: this.configService.get('REDIS_PORT', '6379'),
      REDIS_CLUSTER_ENABLED: this.configService.get('REDIS_CLUSTER_ENABLED', 'false'),
      REDIS_TLS_ENABLED: this.configService.get('REDIS_TLS_ENABLED', 'false'),
      REDIS_LAZY_CONNECT: this.configService.get('REDIS_LAZY_CONNECT', 'true'),
    };

    this.logger.log(`📋 Environment config: ${JSON.stringify(environment)}`);

    // Analyze current config
    const currentConfigAnalysis = this.analyzeCurrentConfig(environment);

    // Run Redis tests in parallel with top-level timeout wrapper
    const [standaloneRedis, clusterRedis] = await Promise.all([
      this.withTimeout(this.testStandaloneRedis(), REDIS_TEST_TIMEOUT, 'standalone-redis'),
      this.withTimeout(this.testClusterRedis(), REDIS_TEST_TIMEOUT, 'cluster-redis'),
    ]);

    // Run Bull config tests with timeout protection
    const bullConfigTests = await this.runAllBullConfigTestsWithTimeout(BULL_TEST_TIMEOUT);

    // Check if we've exceeded overall timeout
    if (Date.now() - startTime > OVERALL_TIMEOUT) {
      this.logger.warn('⚠️ Diagnostic exceeded overall timeout, returning partial results');
    }

    // Generate diagnosis
    const diagnosis = this.generateDiagnosis(
      standaloneRedis,
      clusterRedis,
      bullConfigTests,
      environment,
    );

    const report: FullDebugReport = {
      timestamp: new Date().toISOString(),
      environment,
      current_config_analysis: currentConfigAnalysis,
      standalone_redis_test: standaloneRedis,
      cluster_redis_test: clusterRedis,
      bull_config_tests: bullConfigTests,
      diagnosis,
    };

    this.logger.log(`✅ Diagnostic completed in ${Date.now() - startTime}ms`);
    this.logger.log(`📊 Diagnosis: ${diagnosis.root_cause}`);
    this.logger.log(`💡 Recommendation: ${diagnosis.recommended_fix}`);

    return report;
  }

  /**
   * Wraps a promise with a timeout - returns a failed result instead of hanging
   */
  private async withTimeout<T extends RedisDebugResult | BullQueueDebugResult>(
    promise: Promise<T>,
    timeoutMs: number,
    testName: string,
  ): Promise<T> {
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`Test "${testName}" exceeded ${timeoutMs}ms timeout`)), timeoutMs);
        }),
      ]);
    } catch (error) {
      this.logger.error(`⏱️ [${testName}] Top-level timeout: ${error.message}`);
      // Return a failed result structure
      return {
        mode: testName.includes('cluster') ? 'cluster' : 'standalone',
        config_name: testName,
        description: `Test timed out after ${timeoutMs}ms`,
        overall_status: 'failed',
        steps: [{
          step: 1,
          name: 'Timeout',
          status: 'failed' as const,
          duration_ms: timeoutMs,
          error: error.message,
        }],
        total_duration_ms: timeoutMs,
        config_details: {},
        recommendation: `Test "${testName}" hung and was terminated. This indicates a connection or configuration issue.`,
      } as unknown as T;
    }
  }

  /**
   * Run all Bull config tests with individual timeout protection
   */
  private async runAllBullConfigTestsWithTimeout(timeoutMs: number): Promise<BullQueueDebugResult[]> {
    const results: BullQueueDebugResult[] = [];
    const configs = this.getBullTestConfigs();

    for (const config of configs) {
      try {
        const result = await Promise.race([
          this.testBullConfig(config),
          new Promise<BullQueueDebugResult>((_, reject) => {
            setTimeout(() => reject(new Error(`Bull test "${config.name}" exceeded ${timeoutMs}ms timeout`)), timeoutMs);
          }),
        ]);
        results.push(result);
      } catch (error) {
        this.logger.error(`⏱️ [${config.name}] Top-level timeout: ${error.message}`);
        results.push({
          config_name: config.name,
          description: config.description,
          overall_status: 'failed',
          steps: [{
            step: 1,
            name: 'Timeout',
            status: 'failed' as const,
            duration_ms: timeoutMs,
            error: error.message,
          }],
          total_duration_ms: timeoutMs,
          config_details: {},
          recommendation: `Config "${config.name}" hung and was terminated. Check Redis connectivity.`,
        });
      }
    }

    return results;
  }

  /**
   * Get all Bull test configurations
   */
  private getBullTestConfigs(): Array<{ name: string; description: string; getConfig: () => any }> {
    return [
      {
        name: 'standalone-basic',
        description: 'Standalone Redis with immediate connection (lazyConnect=false)',
        getConfig: () => {
          const baseConfig = this.getStandaloneConfig();
          return {
            redis: {
              ...baseConfig,
              lazyConnect: false,
              enableReadyCheck: false,
              maxRetriesPerRequest: 3,
            },
          };
        },
      },
      {
        name: 'standalone-lazy',
        description: 'Standalone Redis with lazy connection (lazyConnect=true)',
        getConfig: () => {
          const baseConfig = this.getStandaloneConfig();
          return {
            redis: {
              ...baseConfig,
              lazyConnect: true,
              enableReadyCheck: false,
              maxRetriesPerRequest: 3,
            },
          };
        },
      },
      {
        name: 'standalone-nullretries',
        description: 'Standalone Redis with maxRetriesPerRequest=null',
        getConfig: () => {
          const baseConfig = this.getStandaloneConfig();
          return {
            redis: {
              ...baseConfig,
              lazyConnect: false,
              enableReadyCheck: false,
              maxRetriesPerRequest: null,
            },
          };
        },
      },
      {
        name: 'standalone-createclient',
        description: 'Standalone Redis using createClient factory function',
        getConfig: () => {
          const baseConfig = this.getStandaloneConfig();
          return {
            createClient: (type: string) => {
              this.logger.log(`📦 [standalone-createclient] Creating ${type} client...`);
              return new Redis({
                ...baseConfig,
                lazyConnect: false,
                enableReadyCheck: false,
                maxRetriesPerRequest: type === 'client' ? 3 : null,
              });
            },
          };
        },
      },
      {
        name: 'cluster-createclient',
        description: 'Redis Cluster using createClient factory function',
        getConfig: () => {
          const { nodes, options } = this.getClusterConfig();
          return {
            prefix: '{bull}',
            createClient: (type: string) => {
              this.logger.log(`📦 [cluster-createclient] Creating ${type} client...`);
              const cluster = new Cluster(nodes, {
                ...options,
                ...(type !== 'client' && {
                  enableReadyCheck: false,
                  maxRetriesPerRequest: null,
                }),
              });
              return cluster as any;
            },
          };
        },
      },
      {
        name: 'current-app-config',
        description: 'Current application configuration (replicates RedisConfigService)',
        getConfig: () => this.getCurrentAppBullConfig(),
      },
    ];
  }

  private async testBullConfig(config: {
    name: string;
    description: string;
    getConfig: () => any;
  }): Promise<BullQueueDebugResult> {
    const steps: DebugStep[] = [];
    const startTime = Date.now();
    let queue: Queue | null = null;
    let configDetails: any = {};

    this.logger.log(`📦 [${config.name}] Starting Bull config test...`);

    try {
      // Step 1: Get config
      const step1Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 1: Building configuration...`);

      const bullConfig = config.getConfig();
      configDetails = this.sanitizeConfigForLog(bullConfig);

      steps.push({
        step: 1,
        name: 'Build configuration',
        status: 'success',
        duration_ms: Date.now() - step1Start,
        details: configDetails,
      });

      // Step 2: Create queue
      const step2Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 2: Creating queue...`);

      const queueName = `debug-${config.name}-${Date.now()}`;
      queue = new Queue(queueName, bullConfig);

      steps.push({
        step: 2,
        name: 'Create queue',
        status: 'success',
        duration_ms: Date.now() - step2Start,
        details: { queueName },
      });

      // Step 3: Wait for ready (BullMQ queues are ready immediately, but we can verify connection)
      const step3Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 3: Verifying queue is ready...`);

      // In BullMQ, use waitUntilReady() to ensure connection is established
      await Promise.race([queue.waitUntilReady(), this.timeout(20000, 'Queue ready timeout after 20s')]);

      steps.push({
        step: 3,
        name: 'Queue ready',
        status: 'success',
        duration_ms: Date.now() - step3Start,
      });

      // Step 4: Add job
      const step4Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 4: Adding job to queue...`);

      const jobId = `debug-job-${config.name}-${Date.now()}`;
      const job = await Promise.race([
        queue.add(
          'test-job',
          { test: true, config: config.name, timestamp: Date.now() },
          { jobId, removeOnComplete: true, removeOnFail: true },
        ),
        this.timeout(15000, 'Add job timeout after 15s'),
      ]);

      steps.push({
        step: 4,
        name: 'Add job',
        status: 'success',
        duration_ms: Date.now() - step4Start,
        details: { jobId: job.id },
      });

      // Step 5: Get job counts
      const step5Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 5: Getting job counts...`);

      const counts = await Promise.race([
        queue.getJobCounts(),
        this.timeout(10000, 'Get job counts timeout after 10s'),
      ]);

      steps.push({
        step: 5,
        name: 'Get job counts',
        status: 'success',
        duration_ms: Date.now() - step5Start,
        details: counts,
      });

      // Step 6: Retrieve job by ID
      const step6Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 6: Retrieving job by ID...`);

      const retrievedJob = await Promise.race([
        queue.getJob(jobId),
        this.timeout(10000, 'Get job timeout after 10s'),
      ]);

      steps.push({
        step: 6,
        name: 'Retrieve job',
        status: retrievedJob ? 'success' : 'failed',
        duration_ms: Date.now() - step6Start,
        details: { found: !!retrievedJob },
      });

      // Step 7: Remove job
      const step7Start = Date.now();
      this.logger.log(`📦 [${config.name}] Step 7: Removing job...`);

      await Promise.race([
        job.remove(),
        this.timeout(10000, 'Remove job timeout after 10s'),
      ]);

      steps.push({
        step: 7,
        name: 'Remove job',
        status: 'success',
        duration_ms: Date.now() - step7Start,
      });

      // Cleanup
      await this.safeCloseQueue(queue);

      this.logger.log(`✅ [${config.name}] All tests passed!`);

      return {
        config_name: config.name,
        description: config.description,
        overall_status: 'success',
        steps,
        total_duration_ms: Date.now() - startTime,
        job_id: jobId,
        config_details: configDetails,
      };
    } catch (error) {
      this.logger.error(`❌ [${config.name}] Test failed: ${error.message}`);

      if (queue) {
        await this.safeCloseQueue(queue);
      }

      const lastStep = steps.length > 0 ? steps[steps.length - 1].step : 0;
      steps.push({
        step: lastStep + 1,
        name: 'Error occurred',
        status: 'failed',
        duration_ms: 0,
        error: error.message,
      });

      return {
        config_name: config.name,
        description: config.description,
        overall_status: 'failed',
        steps,
        total_duration_ms: Date.now() - startTime,
        config_details: configDetails,
        recommendation: `Config "${config.name}" failed at step ${lastStep + 1}: ${error.message}`,
      };
    }
  }

  private getCurrentAppBullConfig(): any {
    const redisMode = this.configService.get('REDIS_MODE', 'local');
    const clusterEnabled = this.configService.get('REDIS_CLUSTER_ENABLED', 'false') === 'true';

    if (redisMode === 'managed' && clusterEnabled) {
      // Replicate cluster config from RedisConfigService
      const { nodes, options } = this.getClusterConfig();
      return {
        createClient: (type: string) => {
          this.logger.log(`📦 [current-app-config] Creating ${type} client (cluster mode)...`);
          const cluster = new Cluster(nodes, {
            scaleReads: 'slave',
            slotsRefreshTimeout: 1000,
            slotsRefreshInterval: 1000,
            maxRedirections: 16,
            redisOptions: {
              ...options.redisOptions,
              ...(type !== 'client' && {
                enableReadyCheck: false,
                maxRetriesPerRequest: null,
              }),
            },
          });
          return cluster as any;
        },
      };
    }

    // Standalone config
    const baseConfig = this.getStandaloneConfig();
    return {
      redis: {
        ...baseConfig,
        lazyConnect: this.configService.get('REDIS_LAZY_CONNECT', 'true') === 'true',
        enableReadyCheck: this.configService.get('REDIS_ENABLE_READY_CHECK', 'false') === 'true',
        maxRetriesPerRequest: parseInt(this.configService.get('REDIS_MAX_RETRIES_PER_REQUEST', '3'), 10),
      },
    };
  }

  private sanitizeConfigForLog(config: any): any {
    const sanitized: any = {};

    if (config.redis) {
      sanitized.type = 'redis-options';
      sanitized.host = config.redis.host;
      sanitized.port = config.redis.port;
      sanitized.tls = !!config.redis.tls;
      sanitized.lazyConnect = config.redis.lazyConnect;
      sanitized.enableReadyCheck = config.redis.enableReadyCheck;
      sanitized.maxRetriesPerRequest = config.redis.maxRetriesPerRequest;
      sanitized.connectTimeout = config.redis.connectTimeout;
      sanitized.keepAlive = config.redis.keepAlive;
    } else if (config.createClient) {
      sanitized.type = 'createClient-factory';
    }

    if (config.prefix) {
      sanitized.prefix = config.prefix;
    }

    return sanitized;
  }

  private maskSensitive(value: string): string {
    if (!value || value.length < 10) return value;
    return value.substring(0, 10) + '...' + value.substring(value.length - 5);
  }

  private analyzeCurrentConfig(env: any): string {
    const issues: string[] = [];

    if (env.REDIS_MODE === 'managed' && env.REDIS_CLUSTER_ENABLED === 'true') {
      issues.push('Cluster mode enabled - Bull may have compatibility issues with Redis Cluster');
    }

    if (env.REDIS_LAZY_CONNECT === 'true') {
      issues.push('Lazy connect enabled - connection errors may be delayed until first operation');
    }

    if (env.REDIS_TLS_ENABLED === 'true') {
      issues.push('TLS enabled - ensure certificates are valid');
    }

    return issues.length > 0 ? issues.join('; ') : 'Configuration looks standard';
  }

  async testStandaloneRedis(): Promise<RedisDebugResult> {
    const steps: DebugStep[] = [];
    const startTime = Date.now();
    let redis: Redis | null = null;

    this.logger.log('📡 [Standalone Redis] Starting test...');

    try {
      // Step 1: Create connection
      const step1Start = Date.now();
      this.logger.log('📡 [Standalone Redis] Step 1: Creating connection...');

      const config = this.getStandaloneConfig();
      redis = new Redis(config);

      steps.push({
        step: 1,
        name: 'Create standalone connection',
        status: 'success',
        duration_ms: Date.now() - step1Start,
        details: { host: config.host, port: config.port, tls: !!config.tls },
      });

      // Step 2: Connect
      const step2Start = Date.now();
      this.logger.log('📡 [Standalone Redis] Step 2: Connecting...');

      await Promise.race([
        redis.connect(),
        this.timeout(10000, 'Connection timeout after 10s'),
      ]);

      steps.push({
        step: 2,
        name: 'Connect to Redis',
        status: 'success',
        duration_ms: Date.now() - step2Start,
      });

      // Step 3: Ping
      const step3Start = Date.now();
      this.logger.log('📡 [Standalone Redis] Step 3: Ping...');

      const pingResult = await Promise.race([
        redis.ping(),
        this.timeout(5000, 'Ping timeout after 5s'),
      ]);

      steps.push({
        step: 3,
        name: 'Ping Redis',
        status: pingResult === 'PONG' ? 'success' : 'failed',
        duration_ms: Date.now() - step3Start,
        details: { response: pingResult },
      });

      // Step 4: Write test
      const step4Start = Date.now();
      this.logger.log('📡 [Standalone Redis] Step 4: Write test...');

      const testKey = `debug:standalone:${Date.now()}`;
      await Promise.race([
        redis.set(testKey, 'test-value', 'EX', 60),
        this.timeout(5000, 'Write timeout after 5s'),
      ]);

      steps.push({
        step: 4,
        name: 'Write test key',
        status: 'success',
        duration_ms: Date.now() - step4Start,
        details: { key: testKey },
      });

      // Step 5: Read test
      const step5Start = Date.now();
      this.logger.log('📡 [Standalone Redis] Step 5: Read test...');

      const readValue = await Promise.race([
        redis.get(testKey),
        this.timeout(5000, 'Read timeout after 5s'),
      ]);

      steps.push({
        step: 5,
        name: 'Read test key',
        status: readValue === 'test-value' ? 'success' : 'failed',
        duration_ms: Date.now() - step5Start,
        details: { value: readValue },
      });

      // Step 6: Delete test
      const step6Start = Date.now();
      this.logger.log('📡 [Standalone Redis] Step 6: Delete test...');

      await Promise.race([
        redis.del(testKey),
        this.timeout(5000, 'Delete timeout after 5s'),
      ]);

      steps.push({
        step: 6,
        name: 'Delete test key',
        status: 'success',
        duration_ms: Date.now() - step6Start,
      });

      // Cleanup
      await this.safeDisconnect(redis);

      this.logger.log('✅ [Standalone Redis] All tests passed');

      return {
        mode: 'standalone',
        overall_status: 'success',
        steps,
        total_duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`❌ [Standalone Redis] Test failed: ${error.message}`);

      if (redis) {
        await this.safeDisconnect(redis);
      }

      const lastStep = steps.length > 0 ? steps[steps.length - 1].step : 0;
      steps.push({
        step: lastStep + 1,
        name: 'Error occurred',
        status: 'failed',
        duration_ms: 0,
        error: error.message,
      });

      return {
        mode: 'standalone',
        overall_status: 'failed',
        steps,
        total_duration_ms: Date.now() - startTime,
        recommendation: `Standalone connection failed: ${error.message}`,
      };
    }
  }

  async testClusterRedis(): Promise<RedisDebugResult> {
    const steps: DebugStep[] = [];
    const startTime = Date.now();
    let cluster: Cluster | null = null;

    this.logger.log('🔗 [Cluster Redis] Starting test...');

    try {
      // Step 1: Create cluster connection
      const step1Start = Date.now();
      this.logger.log('🔗 [Cluster Redis] Step 1: Creating cluster connection...');

      const { nodes, options } = this.getClusterConfig();
      cluster = new Cluster(nodes, options);

      steps.push({
        step: 1,
        name: 'Create cluster connection',
        status: 'success',
        duration_ms: Date.now() - step1Start,
        details: { nodes: nodes.length, firstNode: nodes[0] },
      });

      // Step 2: Wait for ready
      const step2Start = Date.now();
      this.logger.log('🔗 [Cluster Redis] Step 2: Waiting for ready...');

      await Promise.race([
        new Promise<void>((resolve, reject) => {
          cluster!.once('ready', () => resolve());
          cluster!.once('error', (err) => reject(err));
        }),
        this.timeout(15000, 'Cluster ready timeout after 15s'),
      ]);

      steps.push({
        step: 2,
        name: 'Cluster ready',
        status: 'success',
        duration_ms: Date.now() - step2Start,
      });

      // Step 3: Ping
      const step3Start = Date.now();
      this.logger.log('🔗 [Cluster Redis] Step 3: Ping...');

      const pingResult = await Promise.race([
        cluster.ping(),
        this.timeout(5000, 'Ping timeout after 5s'),
      ]);

      steps.push({
        step: 3,
        name: 'Ping cluster',
        status: pingResult === 'PONG' ? 'success' : 'failed',
        duration_ms: Date.now() - step3Start,
        details: { response: pingResult },
      });

      // Step 4: Write test (using hash tag for same slot)
      const step4Start = Date.now();
      this.logger.log('🔗 [Cluster Redis] Step 4: Write test...');

      const testKey = `{debug}:cluster:${Date.now()}`;
      await Promise.race([
        cluster.set(testKey, 'test-value', 'EX', 60),
        this.timeout(5000, 'Write timeout after 5s'),
      ]);

      steps.push({
        step: 4,
        name: 'Write test key',
        status: 'success',
        duration_ms: Date.now() - step4Start,
        details: { key: testKey },
      });

      // Step 5: Read test
      const step5Start = Date.now();
      this.logger.log('🔗 [Cluster Redis] Step 5: Read test...');

      const readValue = await Promise.race([
        cluster.get(testKey),
        this.timeout(5000, 'Read timeout after 5s'),
      ]);

      steps.push({
        step: 5,
        name: 'Read test key',
        status: readValue === 'test-value' ? 'success' : 'failed',
        duration_ms: Date.now() - step5Start,
        details: { value: readValue },
      });

      // Step 6: Delete test
      const step6Start = Date.now();
      this.logger.log('🔗 [Cluster Redis] Step 6: Delete test...');

      await Promise.race([
        cluster.del(testKey),
        this.timeout(5000, 'Delete timeout after 5s'),
      ]);

      steps.push({
        step: 6,
        name: 'Delete test key',
        status: 'success',
        duration_ms: Date.now() - step6Start,
      });

      // Cleanup
      await this.safeDisconnectCluster(cluster);

      this.logger.log('✅ [Cluster Redis] All tests passed');

      return {
        mode: 'cluster',
        overall_status: 'success',
        steps,
        total_duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`❌ [Cluster Redis] Test failed: ${error.message}`);

      if (cluster) {
        await this.safeDisconnectCluster(cluster);
      }

      const lastStep = steps.length > 0 ? steps[steps.length - 1].step : 0;
      steps.push({
        step: lastStep + 1,
        name: 'Error occurred',
        status: 'failed',
        duration_ms: 0,
        error: error.message,
      });

      return {
        mode: 'cluster',
        overall_status: 'failed',
        steps,
        total_duration_ms: Date.now() - startTime,
        recommendation: `Cluster connection failed: ${error.message}. This is expected if ElastiCache is not in cluster mode.`,
      };
    }
  }

  private getStandaloneConfig(): any {
    const endpoint = this.configService.get('REDIS_HOST', 'localhost');
    const port = parseInt(this.configService.get('REDIS_PORT', '6379'), 10);
    const password = this.configService.get('REDIS_PASSWORD');
    const tlsEnabled = this.configService.get('REDIS_TLS_ENABLED', 'false') === 'true';

    const config: any = {
      host: endpoint,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 10000,
    };

    if (tlsEnabled) {
      config.tls = {
        servername: endpoint,
        rejectUnauthorized: this.configService.get('REDIS_TLS_REJECT_UNAUTHORIZED', 'true') === 'true',
      };
    }

    return config;
  }

  private getClusterConfig(): { nodes: { host: string; port: number }[]; options: any } {
    const endpoint = this.configService.get('REDIS_HOST', 'localhost');
    const port = parseInt(this.configService.get('REDIS_PORT', '6379'), 10);
    const password = this.configService.get('REDIS_PASSWORD');
    const tlsEnabled = this.configService.get('REDIS_TLS_ENABLED', 'false') === 'true';

    const nodes = [{ host: endpoint, port }];

    const redisOptions: any = {
      password: password || undefined,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    };

    if (tlsEnabled) {
      redisOptions.tls = {
        rejectUnauthorized: this.configService.get('REDIS_TLS_REJECT_UNAUTHORIZED', 'true') === 'true',
      };
    }

    const options = {
      redisOptions,
      scaleReads: 'slave' as const,
      slotsRefreshTimeout: 2000,
      slotsRefreshInterval: 5000,
      maxRedirections: 16,
    };

    return { nodes, options };
  }

  private generateDiagnosis(
    standaloneRedis: RedisDebugResult,
    clusterRedis: RedisDebugResult,
    bullTests: BullQueueDebugResult[],
    environment: any,
  ): FullDebugReport['diagnosis'] {
    const workingModes: string[] = [];
    const failingModes: string[] = [];

    if (standaloneRedis.overall_status === 'success') workingModes.push('standalone-redis');
    else failingModes.push('standalone-redis');

    if (clusterRedis.overall_status === 'success') workingModes.push('cluster-redis');
    else failingModes.push('cluster-redis');

    // Analyze Bull tests
    const workingBullConfigs = bullTests
      .filter((t) => t.overall_status === 'success')
      .map((t) => t.config_name);

    const failingBullConfigs = bullTests
      .filter((t) => t.overall_status === 'failed')
      .map((t) => t.config_name);

    // Find the recommended config
    const recommendedConfig = bullTests.find((t) => t.overall_status === 'success');

    let rootCause = '';
    let recommendedFix = '';

    // Analyze results
    if (standaloneRedis.overall_status === 'success' && workingBullConfigs.length > 0) {
      if (clusterRedis.overall_status === 'failed') {
        rootCause = 'ElastiCache is running in STANDALONE mode (not cluster mode). ';
        if (environment.REDIS_CLUSTER_ENABLED === 'true') {
          rootCause += 'REDIS_CLUSTER_ENABLED=true is misconfigured.';
          recommendedFix = 'Set REDIS_CLUSTER_ENABLED=false and use a standalone Bull configuration.';
        } else {
          rootCause += 'Configuration appears correct for standalone mode.';
        }
      } else {
        rootCause = 'Both standalone and cluster Redis connections work.';
      }

      if (workingBullConfigs.length > 0) {
        recommendedFix += ` Working Bull configs: ${workingBullConfigs.join(', ')}.`;
      }
    } else if (standaloneRedis.overall_status === 'success' && workingBullConfigs.length === 0) {
      rootCause = 'Redis connection works but ALL Bull queue configurations fail. This suggests a Bull-specific issue.';
      recommendedFix = 'Check Bull/ioredis version compatibility. Review the step details to see where each config fails.';
    } else if (standaloneRedis.overall_status === 'failed' && clusterRedis.overall_status === 'failed') {
      rootCause = 'Cannot connect to Redis at all.';
      recommendedFix = 'Verify REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, TLS settings, and network/firewall rules.';
    } else {
      rootCause = 'Mixed results. Review individual test details.';
      recommendedFix = 'Check the step-by-step results to identify specific failure points.';
    }

    // Check for current app config failure
    const currentAppConfigTest = bullTests.find((t) => t.config_name === 'current-app-config');
    if (currentAppConfigTest?.overall_status === 'failed' && workingBullConfigs.length > 0) {
      rootCause = `ISSUE FOUND: Current app config fails but other configs work (${workingBullConfigs[0]}). `;
      rootCause += `Current config fails at: ${currentAppConfigTest.steps.find((s) => s.status === 'failed')?.error || 'unknown'}`;
      recommendedFix = `Update RedisConfigService to use the working configuration: "${workingBullConfigs[0]}". `;
      if (recommendedConfig) {
        recommendedFix += `See config_details for the exact configuration.`;
      }
    }

    return {
      working_modes: workingModes,
      failing_modes: failingModes,
      working_bull_configs: workingBullConfigs,
      root_cause: rootCause,
      recommended_fix: recommendedFix,
      recommended_bull_config: recommendedConfig?.config_details,
    };
  }

  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private async safeDisconnect(redis: Redis): Promise<void> {
    try {
      await redis.quit();
    } catch {
      try {
        redis.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  private async safeDisconnectCluster(cluster: Cluster): Promise<void> {
    try {
      await cluster.quit();
    } catch {
      try {
        cluster.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  private async safeCloseQueue(queue: Queue): Promise<void> {
    try {
      await queue.close();
    } catch {
      // Ignore
    }
  }
}
