import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import { AwsServicesHealthIndicator } from './aws-services-health.indicator';
import { CircuitBreakerHealthIndicator } from './circuit-breaker-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let moduleRef: TestingModule;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;
  let mockTypeOrmHealthIndicator: jest.Mocked<TypeOrmHealthIndicator>;
  let mockDatabaseHealthIndicator: jest.Mocked<DatabaseHealthIndicator>;
  let mockRedisHealthEnhancedIndicator: jest.Mocked<RedisHealthEnhancedIndicator>;
  let mockAwsServicesHealthIndicator: jest.Mocked<AwsServicesHealthIndicator>;
  let mockCircuitBreakerHealthIndicator: jest.Mocked<CircuitBreakerHealthIndicator>;

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

    mockDatabaseHealthIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    } as any;

    mockRedisHealthEnhancedIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    } as any;

    mockAwsServicesHealthIndicator = {
      checkTextract: jest.fn().mockResolvedValue({ textract: { status: 'up' } }),
      checkBedrock: jest.fn().mockResolvedValue({ bedrock: { status: 'up' } }),
      checkAllServices: jest.fn().mockResolvedValue({ 'aws-services': { status: 'up' } }),
    } as any;

    mockCircuitBreakerHealthIndicator = {
      isHealthy: jest.fn().mockResolvedValue({ 'circuit-breakers': { status: 'up' } }),
    } as any;

    moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmHealthIndicator },
        { provide: DatabaseHealthIndicator, useValue: mockDatabaseHealthIndicator },
        { provide: RedisHealthEnhancedIndicator, useValue: mockRedisHealthEnhancedIndicator },
        { provide: AwsServicesHealthIndicator, useValue: mockAwsServicesHealthIndicator },
        { provide: CircuitBreakerHealthIndicator, useValue: mockCircuitBreakerHealthIndicator },
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

    it('should check both database (enhanced) and redis', async () => {
      await controller.check();

      expect(mockDatabaseHealthIndicator.isHealthy).toHaveBeenCalledWith('database');
      expect(mockRedisHealthEnhancedIndicator.isHealthy).toHaveBeenCalledWith('redis');
    });
  });

  describe('ready', () => {
    it('should check database and redis for readiness', async () => {
      const result = await controller.ready();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalled();
      expect(mockTypeOrmHealthIndicator.pingCheck).toHaveBeenCalledWith('database');
      expect(mockRedisHealthEnhancedIndicator.isHealthy).toHaveBeenCalledWith('redis');
    });
  });

  describe('checkRedis', () => {
    it('should check only Redis health', async () => {
      const result = await controller.checkRedis();

      expect(result).toBeDefined();
      expect(mockRedisHealthEnhancedIndicator.isHealthy).toHaveBeenCalledWith('redis');
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

  describe('checkTextract', () => {
    it('should check AWS Textract health', async () => {
      const result = await controller.checkTextract();

      expect(result).toBeDefined();
      expect(mockAwsServicesHealthIndicator.checkTextract).toHaveBeenCalledWith('textract');
    });
  });

  describe('checkBedrock', () => {
    it('should check AWS Bedrock health', async () => {
      const result = await controller.checkBedrock();

      expect(result).toBeDefined();
      expect(mockAwsServicesHealthIndicator.checkBedrock).toHaveBeenCalledWith('bedrock');
    });
  });

  describe('checkAwsServices', () => {
    it('should check all AWS services health', async () => {
      const result = await controller.checkAwsServices();

      expect(result).toBeDefined();
      expect(mockAwsServicesHealthIndicator.checkAllServices).toHaveBeenCalledWith('aws-services');
    });
  });
});
