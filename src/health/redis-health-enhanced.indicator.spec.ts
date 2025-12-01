import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

// Mock bullmq
jest.mock('bullmq', () => {
  const mockJob = {
    id: 'test-job-id',
    data: { healthCheck: true },
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueue = {
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(mockJob),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn(() => mockQueue),
    Job: {
      fromId: jest.fn().mockImplementation((_queue, jobId) => {
        // First call returns the job, subsequent calls return undefined (job removed)
        if (jobId === 'test-job-id') {
          const callCount = (jest.mocked(require('bullmq').Job.fromId).mock.calls.length);
          if (callCount <= 1) {
            return Promise.resolve(mockJob);
          }
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      }),
    },
  };
});

const MockedRedis = jest.mocked(Redis);

describe('RedisHealthEnhancedIndicator', () => {
  let indicator: RedisHealthEnhancedIndicator;
  let moduleRef: TestingModule;

  const createStorageBackedMock = () => {
    let storedValue: string | null = null;
    let deleted = false;
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockImplementation((_key: string, value: string) => {
        storedValue = value;
        deleted = false;
        return Promise.resolve('OK');
      }),
      get: jest.fn().mockImplementation(() => {
        if (deleted) {
          return Promise.resolve(null);
        }
        return Promise.resolve(storedValue);
      }),
      del: jest.fn().mockImplementation(() => {
        deleted = true;
        return Promise.resolve(1);
      }),
      info: jest.fn().mockResolvedValue(
        'redis_version:7.0.11\r\n' + 'uptime_in_seconds:86400\r\n' + 'connected_clients:5\r\n',
      ),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
    };
  };

  const setupDefaultMock = () => {
    MockedRedis.mockImplementation(() => createStorageBackedMock() as unknown as Redis);
  };

  const buildModule = async (configMap: Record<string, string | undefined>) => {
    const mockConfigService: jest.Mocked<ConfigService> = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const value = configMap[key];
        return value !== undefined ? value : defaultValue;
      }),
    } as any;

    return Test.createTestingModule({
      providers: [
        RedisHealthEnhancedIndicator,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMock();
    
    // Reset the Job.fromId mock to return job on first call, undefined on second
    const bullmq = require('bullmq');
    let fromIdCallCount = 0;
    bullmq.Job.fromId = jest.fn().mockImplementation(() => {
      fromIdCallCount++;
      if (fromIdCallCount === 1) {
        return Promise.resolve({
          id: 'test-job-id',
          data: { healthCheck: true },
          remove: jest.fn().mockResolvedValue(undefined),
        });
      }
      return Promise.resolve(undefined);
    });
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('isHealthy', () => {
    it('should return healthy status with operation details', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result).toBeDefined();
      expect(result['redis-queue']).toBeDefined();
      expect(result['redis-queue'].status).toBe('up');
      expect(result['redis-queue'].message).toBe('Redis and BullMQ are fully operational');
      
      // Check Redis operations
      expect(result['redis-queue'].redis).toBeDefined();
      expect(result['redis-queue'].redis.status).toBe('healthy');
      expect(result['redis-queue'].redis.operations).toBeDefined();
      expect(result['redis-queue'].redis.operations.write).toBe('success');
      expect(result['redis-queue'].redis.operations.read).toBe('success');
      expect(result['redis-queue'].redis.operations.delete).toBe('success');
    });

    it('should include latency information', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      // Redis latency
      expect(result['redis-queue'].redis.latency).toBeDefined();
      expect(result['redis-queue'].redis.latency.write).toMatch(/\d+ms/);
      expect(result['redis-queue'].redis.latency.read).toMatch(/\d+ms/);
      
      // Total latency
      expect(result['redis-queue'].totalLatency).toMatch(/\d+ms/);
    });

    it('should include server info', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].redis.server).toBeDefined();
      expect(result['redis-queue'].redis.server.version).toBe('7.0.11');
      expect(result['redis-queue'].redis.server.uptimeSeconds).toBe(86400);
      expect(result['redis-queue'].redis.server.connectedClients).toBe(5);
    });

    it('should include BullMQ health check results', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].bullmq).toBeDefined();
      expect(result['redis-queue'].bullmq.status).toBe('healthy');
      expect(result['redis-queue'].bullmq.operations).toBeDefined();
      expect(result['redis-queue'].bullmq.operations.queueConnect).toBe('success');
      expect(result['redis-queue'].bullmq.operations.jobEnqueue).toBe('success');
      expect(result['redis-queue'].bullmq.operations.jobRetrieve).toBe('success');
      expect(result['redis-queue'].bullmq.operations.jobDelete).toBe('success');
    });

    it('should include BullMQ latency information', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].bullmq.latency).toBeDefined();
      expect(result['redis-queue'].bullmq.latency.queueConnect).toMatch(/\d+ms/);
      expect(result['redis-queue'].bullmq.latency.jobLifecycle).toMatch(/\d+ms/);
    });

    it('should include BullMQ queue info', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].bullmq.queueInfo).toBeDefined();
      expect(result['redis-queue'].bullmq.queueInfo.name).toMatch(/^health-bullmq-\d+$/);
      expect(result['redis-queue'].bullmq.queueInfo.jobCounts).toBeDefined();
      expect(result['redis-queue'].bullmq.queueInfo.jobCounts.waiting).toBe(0);
      expect(result['redis-queue'].bullmq.queueInfo.jobCounts.active).toBe(0);
    });

    it('should skip BullMQ health check when includeBullMQ is false', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue', 5000, false);

      expect(result['redis-queue'].bullmq).toBeDefined();
      expect(result['redis-queue'].bullmq.status).toBe('skipped');
    });

    it('should work with managed mode and TLS', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'my-elasticache.cache.amazonaws.com',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'true',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].status).toBe('up');
    });

    it('should throw HealthCheckError on connection failure', async () => {
      MockedRedis.mockImplementation(
        () =>
          ({
            connect: jest.fn().mockRejectedValue(new Error('Connection refused')),
            quit: jest.fn().mockResolvedValue('OK'),
            disconnect: jest.fn(),
          }) as unknown as Redis,
      );

      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow(HealthCheckError);
    });

    it('should throw error when REDIS_HOST missing in managed mode', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        // REDIS_HOST intentionally missing
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow(HealthCheckError);
    });

    it('should throw error on data integrity failure', async () => {
      MockedRedis.mockImplementation(
        () =>
          ({
            connect: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue('wrong-value'), // Returns different value
            del: jest.fn().mockResolvedValue(1),
            quit: jest.fn().mockResolvedValue('OK'),
            disconnect: jest.fn(),
          }) as unknown as Redis,
      );

      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow(HealthCheckError);
    });

    it('should continue with unhealthy BullMQ status if BullMQ fails but Redis works', async () => {
      // Mock BullMQ to fail
      const bullmq = require('bullmq');
      bullmq.Queue = jest.fn(() => ({
        waitUntilReady: jest.fn().mockRejectedValue(new Error('BullMQ connection failed')),
        close: jest.fn().mockResolvedValue(undefined),
      }));

      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      // Redis should still be healthy
      expect(result['redis-queue'].status).toBe('up');
      expect(result['redis-queue'].redis.status).toBe('healthy');
      
      // BullMQ should be unhealthy
      expect(result['redis-queue'].bullmq.status).toBe('unhealthy');
      expect(result['redis-queue'].bullmq.error).toBeDefined();
    });
  });

  describe('timeout handling', () => {
    it('should respect custom timeout', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      const startTime = Date.now();
      await indicator.isHealthy('redis-queue', 10000);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
    });
  });

  describe('BullMQ connection methods', () => {
    it('should use local BullMQ connection for local mode', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      await indicator.isHealthy('redis-queue');

      // Verify Redis was called with maxRetriesPerRequest: null for BullMQ
      const redisCalls = MockedRedis.mock.calls;
      const bullmqCall = redisCalls.find((call: any[]) => call[0]?.maxRetriesPerRequest === null);
      expect(bullmqCall).toBeDefined();
    });

    it('should use managed BullMQ connection for managed mode', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'my-elasticache.cache.amazonaws.com',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'true',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      await indicator.isHealthy('redis-queue');

      // Verify Redis was called with TLS config and maxRetriesPerRequest: null
      const redisCalls = MockedRedis.mock.calls;
      const bullmqCall = redisCalls.find(
        (call: any[]) => call[0]?.maxRetriesPerRequest === null && call[0]?.tls
      );
      expect(bullmqCall).toBeDefined();
    });
  });
});
