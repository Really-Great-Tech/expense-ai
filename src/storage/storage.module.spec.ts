import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageModule } from './storage.module';
import { S3StorageService } from './s3-storage.service';
import { CircuitBreakerService } from '../resilience';

// Skip S3 tests in CI environment (SDK uses default credential chain in production)
const shouldSkipS3Tests = process.env.CI === 'true';
const describeS3 = shouldSkipS3Tests ? describe.skip : describe;

describe('StorageModule', () => {
  let configValues: Record<string, any>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockCircuitBreakerService: jest.Mocked<CircuitBreakerService>;

  const buildModule = async () => {
    return Test.createTestingModule({
      imports: [StorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideProvider(CircuitBreakerService)
      .useValue(mockCircuitBreakerService)
      .compile();
  };

  beforeEach(() => {
    configValues = {
      S3_BUCKET_NAME: 'test-bucket',
      AWS_REGION: 'us-east-1',
      app: {
        aws: { region: 'us-east-1' },
        storage: { s3BucketName: 'test-bucket' },
      },
    };
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const value = configValues[key];
        return value !== undefined ? value : defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    mockCircuitBreakerService = {
      getS3Breaker: jest.fn().mockReturnValue({
        execute: jest.fn().mockImplementation((fn) => fn()),
      }),
    } as unknown as jest.Mocked<CircuitBreakerService>;
  });

  describeS3('S3 Storage Configuration', () => {
    it('should provide S3StorageService', async () => {
      const module: TestingModule = await buildModule();

      const storageService = module.get<S3StorageService>(S3StorageService);

      expect(storageService).toBeDefined();
      expect(storageService).toBeInstanceOf(S3StorageService);
    });

    it('should throw error when S3_BUCKET_NAME is not set', async () => {
      delete configValues.S3_BUCKET_NAME;
      configValues.app.storage.s3BucketName = undefined;

      await expect(buildModule()).rejects.toThrow('S3_BUCKET_NAME is required for S3StorageService');
    });
  });

  describeS3('Storage Service Methods', () => {
    let module: TestingModule;
    let storageService: S3StorageService;

    beforeEach(async () => {
      module = await buildModule();
      storageService = module.get<S3StorageService>(S3StorageService);
    });

    it('should have all required methods', () => {
      // Core S3 operations
      expect(typeof storageService.uploadFile).toBe('function');
      expect(typeof storageService.downloadFile).toBe('function');
      expect(typeof storageService.getFile).toBe('function');
      expect(typeof storageService.getFileInfo).toBe('function');
      expect(typeof storageService.fileExists).toBe('function');
      expect(typeof storageService.deleteFile).toBe('function');

      // Document upload helpers
      expect(typeof storageService.uploadOriginalDocument).toBe('function');
      expect(typeof storageService.uploadOriginalFile).toBe('function');

      // Result operations
      expect(typeof storageService.saveResult).toBe('function');
      expect(typeof storageService.loadResult).toBe('function');
      expect(typeof storageService.saveValidationResult).toBe('function');
      expect(typeof storageService.saveMarkdownExtraction).toBe('function');

      // File reading operations
      expect(typeof storageService.readFile).toBe('function');
      expect(typeof storageService.readFileAsString).toBe('function');
      expect(typeof storageService.readLocalConfigFile).toBe('function');

      // Metadata helpers
      expect(typeof storageService.buildStorageMetadata).toBe('function');
      expect(typeof storageService.getStorageBucket).toBe('function');
      expect(typeof storageService.getS3Url).toBe('function');
      expect(typeof storageService.extractKeyFromUrl).toBe('function');
    });

    it('should be properly exported for dependency injection', () => {
      expect(storageService).toBeDefined();
    });
  });

  describeS3('Service Singleton Behavior', () => {
    it('should return the same instance when requested multiple times', async () => {
      const module: TestingModule = await buildModule();

      const storageService1 = module.get<S3StorageService>(S3StorageService);
      const storageService2 = module.get<S3StorageService>(S3StorageService);

      expect(storageService1).toBe(storageService2);
    });
  });
});
