import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

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
      expect(result['redis-queue'].message).toBe('Redis is fully operational');
      expect(result['redis-queue'].operations).toBeDefined();
      expect(result['redis-queue'].operations.write).toBe('success');
      expect(result['redis-queue'].operations.read).toBe('success');
      expect(result['redis-queue'].operations.delete).toBe('success');
    });

    it('should include latency information', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].latency).toBeDefined();
      expect(result['redis-queue'].latency.write).toMatch(/\d+ms/);
      expect(result['redis-queue'].latency.read).toMatch(/\d+ms/);
      expect(result['redis-queue'].latency.total).toMatch(/\d+ms/);
    });

    it('should include server info', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthEnhancedIndicator);
      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].server).toBeDefined();
      expect(result['redis-queue'].server.version).toBe('7.0.11');
      expect(result['redis-queue'].server.uptimeSeconds).toBe(86400);
      expect(result['redis-queue'].server.connectedClients).toBe(5);
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
});
