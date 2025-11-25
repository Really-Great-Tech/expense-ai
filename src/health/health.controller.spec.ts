import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis-health.indicator';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import { RedisDebugService } from './redis-debug.service';

describe('HealthController', () => {
  let controller: HealthController;
  let moduleRef: TestingModule;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;
  let mockTypeOrmHealthIndicator: jest.Mocked<TypeOrmHealthIndicator>;
  let mockRedisHealthIndicator: jest.Mocked<RedisHealthIndicator>;
  let mockDatabaseHealthIndicator: jest.Mocked<DatabaseHealthIndicator>;
  let mockRedisHealthEnhancedIndicator: jest.Mocked<RedisHealthEnhancedIndicator>;
  let mockRedisDebugService: jest.Mocked<RedisDebugService>;

  beforeEach(async () => {
    mockHealthCheckService = {
      check: jest.fn().mockImplementation(async (indicators) => {
        const results: any = { status: 'ok', info: {}, error: {}, details: {} };
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results.info, result);
          Object.assign(results.details, result);
        }
        return results;
      }),
    } as any;

    mockTypeOrmHealthIndicator = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    } as any;

    mockRedisHealthIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ 'redis-queue': { status: 'up' } }),
    } as any;

    mockDatabaseHealthIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
      checkMigrationStatus: jest.fn().mockResolvedValue({ migrations: { status: 'up' } }),
    } as any;

    mockRedisHealthEnhancedIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ 'redis-queue': { status: 'up' } }),
    } as any;

    mockRedisDebugService = {
      runFullDiagnostic: jest.fn().mockResolvedValue({
        timestamp: new Date().toISOString(),
        environment: {
          REDIS_MODE: 'local',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_CLUSTER_ENABLED: 'false',
          REDIS_TLS_ENABLED: 'false',
          REDIS_LAZY_CONNECT: 'true',
        },
        current_config_analysis: 'Configuration looks standard',
        standalone_redis_test: { mode: 'standalone', overall_status: 'success', steps: [] },
        cluster_redis_test: { mode: 'cluster', overall_status: 'failed', steps: [] },
        bull_config_tests: [],
        diagnosis: {
          working_modes: ['standalone-redis'],
          failing_modes: ['cluster-redis'],
          working_bull_configs: [],
          root_cause: 'Test',
          recommended_fix: 'Test',
        },
      }),
    } as any;

    moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmHealthIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisHealthIndicator },
        { provide: DatabaseHealthIndicator, useValue: mockDatabaseHealthIndicator },
        { provide: RedisHealthEnhancedIndicator, useValue: mockRedisHealthEnhancedIndicator },
        { provide: RedisDebugService, useValue: mockRedisDebugService },
      ],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('check', () => {
    it('should return health check result', async () => {
      const result = await controller.check();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });

    it('should check both database and redis', async () => {
      await controller.check();

      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database');
      expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis-queue');
    });
  });

  describe('ready', () => {
    it('should return ready status immediately', async () => {
      const result = await controller.ready();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.message).toBe('Application is ready to accept requests');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('checkRedis', () => {
    it('should check only Redis health', async () => {
      const result = await controller.checkRedis();

      expect(result).toBeDefined();
      expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis-queue');
    });
  });

  describe('checkDatabase', () => {
    it('should check only database health', async () => {
      const result = await controller.checkDatabase();

      expect(result).toBeDefined();
      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database');
    });
  });

  describe('checkDatabaseEnhanced', () => {
    it('should use enhanced database health check', async () => {
      const result = await controller.checkDatabaseEnhanced();

      expect(result).toBeDefined();
      expect(mockDatabaseHealthIndicator.isHealthy).toHaveBeenCalledWith('database');
    });
  });

  describe('checkRedisEnhanced', () => {
    it('should use enhanced Redis health check', async () => {
      const result = await controller.checkRedisEnhanced();

      expect(result).toBeDefined();
      expect(mockRedisHealthEnhancedIndicator.isHealthy).toHaveBeenCalledWith('redis-queue');
    });
  });

  describe('checkMigrations', () => {
    it('should check migration status', async () => {
      const result = await controller.checkMigrations();

      expect(result).toBeDefined();
      expect(mockDatabaseHealthIndicator.checkMigrationStatus).toHaveBeenCalled();
    });
  });

  describe('debugRedis', () => {
    it('should return full diagnostic report', async () => {
      const result = await controller.debugRedis();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.environment).toBeDefined();
      expect(result.standalone_redis_test).toBeDefined();
      expect(result.cluster_redis_test).toBeDefined();
      expect(result.diagnosis).toBeDefined();
      expect(mockRedisDebugService.runFullDiagnostic).toHaveBeenCalled();
    });
  });
});
