import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import Redis from 'ioredis';

jest.mock('ioredis');

const MockedRedis = jest.mocked(Redis);

describe('RedisHealthEnhancedIndicator', () => {
  let indicator: RedisHealthEnhancedIndicator;
  let moduleRef: TestingModule;

  const createRedisMock = (options: { pingResult?: string; connectError?: Error; pingError?: Error } = {}) => ({
    connect: options.connectError ? jest.fn().mockRejectedValue(options.connectError) : jest.fn().mockResolvedValue(undefined),
    ping: options.pingError ? jest.fn().mockRejectedValue(options.pingError) : jest.fn().mockResolvedValue(options.pingResult || 'PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    on: jest.fn(),
  });

  const buildModule = async (host?: string, port = 6379) => {
    const appConfig = {
      redis: {
        host,
        port,
      },
    };

    const mockConfigService: jest.Mocked<ConfigService> = {
      get: jest.fn((key: string) => {
        if (key === 'app') {
          return appConfig;
        }
        return undefined;
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
    MockedRedis.mockImplementation(() => createRedisMock() as unknown as Redis);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('isHealthy', () => {
    it('should return healthy status when ping succeeds', async () => {
      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      const result = await indicator.isHealthy('redis-queue');

      expect(result).toBeDefined();
      expect(result['redis-queue']).toBeDefined();
      expect(result['redis-queue'].status).toBe('healthy');
      expect(result['redis-queue'].latency).toMatch(/\d+ms/);
    });

    it('should throw HealthCheckError when REDIS_HOST is not configured', async () => {
      moduleRef = await buildModule(undefined);
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow(HealthCheckError);
    });

    it('should throw HealthCheckError on connection failure', async () => {
      MockedRedis.mockImplementation(() => createRedisMock({ connectError: new Error('Connection refused') }) as unknown as Redis);

      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow(HealthCheckError);
    });

    it('should throw HealthCheckError on ping failure', async () => {
      MockedRedis.mockImplementation(() => createRedisMock({ pingError: new Error('NOAUTH Authentication required') }) as unknown as Redis);

      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow(HealthCheckError);
    });

    it('should work with ElastiCache endpoint', async () => {
      moduleRef = await buildModule('my-cluster.cache.amazonaws.com', 6379);
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      const result = await indicator.isHealthy('redis-queue');

      expect(result['redis-queue'].status).toBe('healthy');
    });

    it('should accept custom timeout parameter', async () => {
      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      const result = await indicator.isHealthy('redis-queue', 10000);

      expect(result['redis-queue'].status).toBe('healthy');
    });

  });

  describe('timeout handling', () => {
    it('should timeout if Redis is unresponsive', async () => {
      MockedRedis.mockImplementation(
        () =>
          ({
            connect: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
            quit: jest.fn().mockResolvedValue('OK'),
            disconnect: jest.fn(),
            on: jest.fn(),
          }) as unknown as Redis,
      );

      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue', 100)).rejects.toThrow(HealthCheckError);
    });
  });

  describe('connection cleanup', () => {
    it('should close connection after successful health check', async () => {
      const mockRedis = createRedisMock();
      MockedRedis.mockImplementation(() => mockRedis as unknown as Redis);

      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await indicator.isHealthy('redis-queue');

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should close connection after failed health check', async () => {
      const mockRedis = createRedisMock({ connectError: new Error('Connection refused') });
      MockedRedis.mockImplementation(() => mockRedis as unknown as Redis);

      moduleRef = await buildModule('localhost');
      indicator = moduleRef.get(RedisHealthEnhancedIndicator);

      await expect(indicator.isHealthy('redis-queue')).rejects.toThrow();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
