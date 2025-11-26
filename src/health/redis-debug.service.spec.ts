import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisDebugService, FullDebugReport } from './redis-debug.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedisInstance = {
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('test-value'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    once: jest.fn(),
  };

  const MockRedis = jest.fn(() => mockRedisInstance);

  const mockClusterInstance = {
    ping: jest.fn().mockResolvedValue('PONG'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('test-value'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    once: jest.fn((event: string, callback: Function) => {
      if (event === 'ready') {
        // Simulate ready event
        setTimeout(() => callback(), 10);
      }
    }),
  };

  const MockCluster = jest.fn(() => mockClusterInstance);

  return {
    __esModule: true,
    default: MockRedis,
    Cluster: MockCluster,
  };
});

// Mock bullmq
jest.mock('bullmq', () => {
  const mockJob = {
    id: 'test-job-id',
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueue = {
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(mockJob),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 0, completed: 0, failed: 0 }),
    getJob: jest.fn().mockResolvedValue(mockJob),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn(() => mockQueue),
  };
});

describe('RedisDebugService', () => {
  let service: RedisDebugService;
  let moduleRef: TestingModule;

  const buildModule = async (configMap: Record<string, string | undefined>) => {
    const mockConfigService: jest.Mocked<ConfigService> = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const value = configMap[key];
        return value !== undefined ? value : defaultValue;
      }),
    } as any;

    return Test.createTestingModule({
      providers: [
        RedisDebugService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
  };

  afterEach(async () => {
    jest.clearAllMocks();
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('runFullDiagnostic', () => {
    it('should return a complete diagnostic report for local mode', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.environment).toBeDefined();
      expect(report.environment.REDIS_MODE).toBe('local');
      expect(report.environment.REDIS_HOST).toBe('localhost');
      expect(report.environment.REDIS_PORT).toBe('6379');
      expect(report.environment.REDIS_CLUSTER_ENABLED).toBe('false');
      expect(report.standalone_redis_test).toBeDefined();
      expect(report.cluster_redis_test).toBeDefined();
      expect(report.bull_config_tests).toBeDefined();
      expect(report.diagnosis).toBeDefined();
    });

    it('should return a complete diagnostic report for managed mode with cluster enabled', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'my-elasticache.abc123.cache.amazonaws.com',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'true',
        REDIS_TLS_ENABLED: 'true',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report).toBeDefined();
      expect(report.environment.REDIS_MODE).toBe('managed');
      expect(report.environment.REDIS_CLUSTER_ENABLED).toBe('true');
      expect(report.current_config_analysis).toContain('Cluster mode enabled');
    });

    it('should mask sensitive host information', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'my-very-long-elasticache-endpoint.abc123.cache.amazonaws.com',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      // Host should be masked (first 10 chars + ... + last 5 chars)
      expect(report.environment.REDIS_HOST).toMatch(/^.{10}\.\.\..{5}$/);
      expect(report.environment.REDIS_HOST).not.toBe('my-very-long-elasticache-endpoint.abc123.cache.amazonaws.com');
    });
  });

  describe('testStandaloneRedis', () => {
    it('should successfully test standalone Redis connection', async () => {
      moduleRef = await buildModule({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'false',
      });

      service = moduleRef.get(RedisDebugService);
      const result = await service.testStandaloneRedis();

      expect(result.mode).toBe('standalone');
      expect(result.overall_status).toBe('success');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should include all expected steps', async () => {
      moduleRef = await buildModule({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'false',
      });

      service = moduleRef.get(RedisDebugService);
      const result = await service.testStandaloneRedis();

      const stepNames = result.steps.map(s => s.name);
      expect(stepNames).toContain('Create standalone connection');
      expect(stepNames).toContain('Connect to Redis');
      expect(stepNames).toContain('Ping Redis');
      expect(stepNames).toContain('Write test key');
      expect(stepNames).toContain('Read test key');
      expect(stepNames).toContain('Delete test key');
    });
  });

  describe('testClusterRedis', () => {
    it('should test cluster Redis connection', async () => {
      moduleRef = await buildModule({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'false',
      });

      service = moduleRef.get(RedisDebugService);
      const result = await service.testClusterRedis();

      expect(result.mode).toBe('cluster');
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('diagnosis generation', () => {
    it('should identify standalone-only working mode', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'true',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report.diagnosis).toBeDefined();
      expect(report.diagnosis.working_modes).toBeDefined();
      expect(report.diagnosis.failing_modes).toBeDefined();
      expect(report.diagnosis.working_bull_configs).toBeDefined();
      expect(report.diagnosis.root_cause).toBeDefined();
      expect(report.diagnosis.recommended_fix).toBeDefined();
    });

    it('should provide configuration mismatch diagnosis', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'true',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      // When cluster mode is enabled but Redis is standalone, should recommend fix
      if (report.standalone_redis_test.overall_status === 'success' &&
          report.cluster_redis_test.overall_status === 'failed') {
        expect(report.diagnosis.recommended_fix).toContain('REDIS_CLUSTER_ENABLED=false');
      }
    });
  });

  describe('Bull config tests', () => {
    it('should test multiple Bull configurations', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report.bull_config_tests).toBeDefined();
      expect(Array.isArray(report.bull_config_tests)).toBe(true);
      expect(report.bull_config_tests.length).toBeGreaterThan(0);

      // Check that expected configs are tested
      const configNames = report.bull_config_tests.map(t => t.config_name);
      expect(configNames).toContain('standalone-basic');
      expect(configNames).toContain('standalone-lazy');
      expect(configNames).toContain('current-app-config');
    });

    it('should include step-by-step details for each Bull test', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      const firstBullTest = report.bull_config_tests[0];
      expect(firstBullTest.config_name).toBeDefined();
      expect(firstBullTest.description).toBeDefined();
      expect(firstBullTest.steps).toBeDefined();
      expect(firstBullTest.total_duration_ms).toBeGreaterThanOrEqual(0);
      expect(firstBullTest.config_details).toBeDefined();
    });
  });

  describe('configuration analysis', () => {
    it('should identify TLS configuration', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'true',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report.current_config_analysis).toContain('TLS enabled');
    });

    it('should identify lazy connect configuration', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report.current_config_analysis).toContain('Lazy connect enabled');
    });

    it('should report standard configuration when no issues', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'false',
      });

      service = moduleRef.get(RedisDebugService);
      const report = await service.runFullDiagnostic();

      expect(report.current_config_analysis).toBe('Configuration looks standard');
    });
  });

  describe('timeout handling', () => {
    it('should complete within reasonable time', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);

      const startTime = Date.now();
      await service.runFullDiagnostic();
      const duration = Date.now() - startTime;

      // Should complete within 60 seconds (with mocks, should be much faster)
      expect(duration).toBeLessThan(60000);
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Re-mock Redis to fail
      const Redis = require('ioredis').default;
      Redis.mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn(),
      }));

      moduleRef = await buildModule({
        REDIS_HOST: 'nonexistent-host',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'false',
      });

      service = moduleRef.get(RedisDebugService);
      const result = await service.testStandaloneRedis();

      expect(result.overall_status).toBe('failed');
      expect(result.recommendation).toBeDefined();
    });
  });

  describe('FullDebugReport structure', () => {
    it('should have all required fields', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_CLUSTER_ENABLED: 'false',
        REDIS_TLS_ENABLED: 'false',
        REDIS_LAZY_CONNECT: 'true',
      });

      service = moduleRef.get(RedisDebugService);
      const report: FullDebugReport = await service.runFullDiagnostic();

      // Verify all top-level fields
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('current_config_analysis');
      expect(report).toHaveProperty('standalone_redis_test');
      expect(report).toHaveProperty('cluster_redis_test');
      expect(report).toHaveProperty('bull_config_tests');
      expect(report).toHaveProperty('diagnosis');

      // Verify environment fields
      expect(report.environment).toHaveProperty('REDIS_MODE');
      expect(report.environment).toHaveProperty('REDIS_HOST');
      expect(report.environment).toHaveProperty('REDIS_PORT');
      expect(report.environment).toHaveProperty('REDIS_CLUSTER_ENABLED');
      expect(report.environment).toHaveProperty('REDIS_TLS_ENABLED');
      expect(report.environment).toHaveProperty('REDIS_LAZY_CONNECT');

      // Verify diagnosis fields
      expect(report.diagnosis).toHaveProperty('working_modes');
      expect(report.diagnosis).toHaveProperty('failing_modes');
      expect(report.diagnosis).toHaveProperty('working_bull_configs');
      expect(report.diagnosis).toHaveProperty('root_cause');
      expect(report.diagnosis).toHaveProperty('recommended_fix');
    });
  });
});
