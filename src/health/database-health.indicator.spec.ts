import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { DatabaseHealthIndicator } from './database-health.indicator';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let moduleRef: TestingModule;
  let mockDataSource: jest.Mocked<DataSource>;

  const buildModule = async (dataSourceOptions: Partial<DataSource> = {}) => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{
        version: '8.0.35',
        maxConnections: '151',
        currentConnections: '5',
      }]),
      showMigrations: jest.fn().mockResolvedValue(false),
      ...dataSourceOptions,
    } as any;

    return Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        {
          provide: DataSource,
          useValue: mockDataSource,
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

  describe('isHealthy', () => {
    it('should return healthy status when database is operational', async () => {
      moduleRef = await buildModule();
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('database');

      expect(result).toBeDefined();
      expect(result.database).toBeDefined();
      expect(result.database.status).toBe('up');
      expect(result.database.message).toBe('Database is operational');
    });

    it('should include MySQL version info', async () => {
      moduleRef = await buildModule();
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('database');

      expect(result.database.mysqlVersion).toBe('8.0.35');
    });

    it('should include connection pool information', async () => {
      moduleRef = await buildModule();
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('database');

      expect(result.database.maxConnections).toBe(151);
      expect(result.database.currentConnections).toBe(5);
      expect(result.database.connectionPool).toBeDefined();
      expect(result.database.connectionPool.status).toBe('healthy');
      expect(result.database.connectionPool.utilizationPercent).toBe(3); // 5/151 ~ 3%
    });

    it('should include response time', async () => {
      moduleRef = await buildModule();
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('database');

      expect(result.database.responseTime).toMatch(/\d+ms/);
    });

    it('should throw HealthCheckError when datasource not initialized', async () => {
      moduleRef = await buildModule({ isInitialized: false });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError);
    });

    it('should throw HealthCheckError on query failure', async () => {
      moduleRef = await buildModule({
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
      });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError);
    });

    it('should use custom key in result', async () => {
      moduleRef = await buildModule();
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('custom-db-key');

      expect(result['custom-db-key']).toBeDefined();
      expect(result['custom-db-key'].status).toBe('up');
    });

    it('should respect custom timeout', async () => {
      moduleRef = await buildModule();
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const startTime = Date.now();
      await indicator.isHealthy('database', 10000);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
    });
  });

  describe('checkMigrationStatus', () => {
    it('should return healthy when no pending migrations', async () => {
      moduleRef = await buildModule({
        showMigrations: jest.fn().mockResolvedValue(false),
      });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.checkMigrationStatus();

      expect(result).toBeDefined();
      expect(result.migrations).toBeDefined();
      expect(result.migrations.status).toBe('up');
      expect(result.migrations.message).toBe('All migrations applied');
      expect(result.migrations.hasPendingMigrations).toBe(false);
    });

    it('should return unhealthy when pending migrations exist', async () => {
      moduleRef = await buildModule({
        showMigrations: jest.fn().mockResolvedValue(true),
      });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.checkMigrationStatus();

      expect(result.migrations.status).toBe('down');
      expect(result.migrations.message).toBe('Pending migrations detected');
      expect(result.migrations.hasPendingMigrations).toBe(true);
      expect(result.migrations.recommendation).toBeDefined();
    });

    it('should handle migration check errors gracefully', async () => {
      moduleRef = await buildModule({
        showMigrations: jest.fn().mockRejectedValue(new Error('Migration check failed')),
      });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.checkMigrationStatus();

      expect(result.migrations.status).toBe('down');
      expect(result.migrations.message).toContain('Failed to check migration status');
    });
  });

  describe('connection pool utilization', () => {
    it('should calculate correct utilization percentage', async () => {
      moduleRef = await buildModule({
        query: jest.fn().mockResolvedValue([{
          version: '8.0.35',
          maxConnections: '100',
          currentConnections: '25',
        }]),
      });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('database');

      expect(result.database.connectionPool.utilizationPercent).toBe(25);
    });

    it('should handle high utilization', async () => {
      moduleRef = await buildModule({
        query: jest.fn().mockResolvedValue([{
          version: '8.0.35',
          maxConnections: '100',
          currentConnections: '95',
        }]),
      });
      indicator = moduleRef.get(DatabaseHealthIndicator);

      const result = await indicator.isHealthy('database');

      expect(result.database.connectionPool.utilizationPercent).toBe(95);
    });
  });
});
