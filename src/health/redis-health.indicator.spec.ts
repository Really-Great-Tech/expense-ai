import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

const MockedRedis = jest.mocked(Redis);

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let moduleRef: TestingModule;

  const setupDefaultMock = () => {
    MockedRedis.mockImplementation(
      () =>
        ({
          connect: jest.fn().mockResolvedValue(undefined),
          ping: jest.fn().mockResolvedValue('PONG'),
          quit: jest.fn().mockResolvedValue('OK'),
          disconnect: jest.fn(),
        }) as unknown as Redis,
    );
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
        RedisHealthIndicator,
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
    it('should return healthy status when Redis is reachable', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthIndicator);
      const result = await indicator.isHealthy('redis');

      expect(result).toBeDefined();
      expect(result.redis).toBeDefined();
      expect(result.redis.status).toBe('up');
      expect(result.redis.message).toBe('Redis is reachable');
    });

    it('should work with managed mode configuration', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'my-elasticache.cache.amazonaws.com',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'false',
      });

      indicator = moduleRef.get(RedisHealthIndicator);
      const result = await indicator.isHealthy('redis');

      expect(result.redis.status).toBe('up');
    });

    it('should work with TLS enabled', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        REDIS_HOST: 'my-elasticache.cache.amazonaws.com',
        REDIS_PORT: '6379',
        REDIS_TLS_ENABLED: 'true',
      });

      indicator = moduleRef.get(RedisHealthIndicator);
      const result = await indicator.isHealthy('redis');

      expect(result.redis.status).toBe('up');
    });

    it('should throw HealthCheckError when ping fails', async () => {
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

      indicator = moduleRef.get(RedisHealthIndicator);

      await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
    });

    it('should throw error when REDIS_HOST missing in managed mode', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'managed',
        // REDIS_HOST intentionally missing
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthIndicator);

      await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
    });

    it('should respect custom timeout', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthIndicator);

      const startTime = Date.now();
      await indicator.isHealthy('redis', 10000);
      const duration = Date.now() - startTime;

      // Should complete quickly with mocks
      expect(duration).toBeLessThan(10000);
    });

    it('should use custom key in result', async () => {
      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthIndicator);
      const result = await indicator.isHealthy('custom-redis-key');

      expect(result['custom-redis-key']).toBeDefined();
      expect(result['custom-redis-key'].status).toBe('up');
    });
  });

  describe('connection handling', () => {
    it('should close connection after successful check', async () => {
      const mockQuit = jest.fn().mockResolvedValue('OK');
      MockedRedis.mockImplementation(
        () =>
          ({
            connect: jest.fn().mockResolvedValue(undefined),
            ping: jest.fn().mockResolvedValue('PONG'),
            quit: mockQuit,
            disconnect: jest.fn(),
          }) as unknown as Redis,
      );

      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthIndicator);
      await indicator.isHealthy('redis');

      expect(mockQuit).toHaveBeenCalled();
    });

    it('should close connection on error', async () => {
      const mockDisconnect = jest.fn();
      MockedRedis.mockImplementation(
        () =>
          ({
            connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
            ping: jest.fn(),
            quit: jest.fn().mockRejectedValue(new Error('quit failed')),
            disconnect: mockDisconnect,
          }) as unknown as Redis,
      );

      moduleRef = await buildModule({
        REDIS_MODE: 'local',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      });

      indicator = moduleRef.get(RedisHealthIndicator);

      try {
        await indicator.isHealthy('redis');
      } catch {
        // Expected to fail
      }

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
