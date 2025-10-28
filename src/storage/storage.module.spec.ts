import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageModule } from './storage.module';
import { LocalStorageService } from './services/local-storage.service';
import { S3StorageService } from './services/s3-storage.service';
import { FileStorageService } from './interfaces/file-storage.interface';

// Skip S3 tests in CI environment or when AWS credentials are not available
const shouldSkipS3Tests = process.env.CI === 'true' || !process.env.AWS_ACCESS_KEY_ID;
const describeS3 = shouldSkipS3Tests ? describe.skip : describe;

describe('StorageModule', () => {
  let configValues: Record<string, string | undefined>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const buildModule = async () => {
    return Test.createTestingModule({
      imports: [StorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();
  };

  beforeEach(() => {
    configValues = {};
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const value = configValues[key];
        return value !== undefined ? value : defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;
  });

  describe('Local Storage Configuration', () => {
    it('should provide LocalStorageService when STORAGE_TYPE is local', async () => {
      configValues.STORAGE_TYPE = 'local';

      const module: TestingModule = await buildModule();

      const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      
      expect(storageService).toBeDefined();
      expect(storageService).toBeInstanceOf(LocalStorageService);
    });

    it('should provide LocalStorageService when STORAGE_TYPE is not set (default)', async () => {
      // Don't set STORAGE_TYPE, should default to local
      
      const module: TestingModule = await buildModule();

      const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      
      expect(storageService).toBeDefined();
      expect(storageService).toBeInstanceOf(LocalStorageService);
    });

    it('should provide LocalStorageService when STORAGE_TYPE is invalid', async () => {
      configValues.STORAGE_TYPE = 'invalid-storage-type';
      
      const module: TestingModule = await buildModule();

      const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      
      expect(storageService).toBeDefined();
      expect(storageService).toBeInstanceOf(LocalStorageService);
    });
  });

  describeS3('S3 Storage Configuration', () => {
    it('should provide S3StorageService when STORAGE_TYPE is s3 and S3_BUCKET_NAME is set', async () => {
      configValues.STORAGE_TYPE = 's3';
      configValues.S3_BUCKET_NAME = 'test-bucket';
      configValues.AWS_REGION = 'us-east-1';
      configValues.AWS_ACCESS_KEY_ID = 'test-key';
      configValues.AWS_SECRET_ACCESS_KEY = 'test-secret';

      const module: TestingModule = await buildModule();

      const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      
      expect(storageService).toBeDefined();
      expect(storageService).toBeInstanceOf(S3StorageService);
    });

    it('should throw error when STORAGE_TYPE is s3 but S3_BUCKET_NAME is not set', async () => {
      configValues.STORAGE_TYPE = 's3';
      // Don't set S3_BUCKET_NAME

      await expect(
        buildModule()
      ).rejects.toThrow('S3_BUCKET_NAME is required for S3StorageService');
    });
  });

  describe('Storage Service Interface', () => {
    let module: TestingModule;
    let storageService: FileStorageService;

    beforeEach(async () => {
      configValues.STORAGE_TYPE = 'local';
      
      module = await buildModule();

      storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
    });

    it('should have all required interface methods', () => {
      // Document operations
      expect(typeof storageService.uploadFile).toBe('function');
      expect(typeof storageService.downloadFile).toBe('function');
      expect(typeof storageService.getFileInfo).toBe('function');
      expect(typeof storageService.fileExists).toBe('function');
      expect(typeof storageService.deleteFile).toBe('function');
      
      // Result operations
      expect(typeof storageService.saveResult).toBe('function');
      expect(typeof storageService.loadResult).toBe('function');
      
      // Directory operations
      expect(typeof storageService.ensureDirectory).toBe('function');
      expect(typeof storageService.moveFile).toBe('function');
      
      // File reading operations
      expect(typeof storageService.readFile).toBe('function');
      expect(typeof storageService.readFileAsString).toBe('function');
      
      // Additional methods
      expect(typeof storageService.saveValidationResult).toBe('function');
      expect(typeof storageService.saveMarkdownExtraction).toBe('function');
      expect(typeof storageService.readLocalConfigFile).toBe('function');
      expect(typeof storageService.validateLocalFile).toBe('function');
    });

    it('should be properly exported for dependency injection', () => {
      // Ensure the primary injection token resolves without errors
      expect(storageService).toBeDefined();
    });
  });

  describe('Module Provider Configuration', () => {
    it('should register the storage service provider correctly', async () => {
      configValues.STORAGE_TYPE = 'local';
      
      const module: TestingModule = await buildModule();

      // Test that the service can be injected using the token
      const storageService = module.get('FILE_STORAGE_SERVICE');
      expect(storageService).toBeDefined();
      expect(storageService).toBeInstanceOf(LocalStorageService);
    });

    it('should make the service globally available', async () => {
      configValues.STORAGE_TYPE = 'local';
      
      const module: TestingModule = await buildModule();

      // The module should be marked as global, so services should be available
      const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      expect(storageService).toBeDefined();
    });
  });

  describe('Environment Variable Handling', () => {
    const testCases = [
      { storageType: 'local', expectedService: LocalStorageService },
      { storageType: 'LOCAL', expectedService: LocalStorageService },
      { storageType: 'Local', expectedService: LocalStorageService },
    ];

    testCases.forEach(({ storageType, expectedService }) => {
      it(`should handle STORAGE_TYPE="${storageType}" correctly`, async () => {
        configValues.STORAGE_TYPE = storageType;
        
        const module: TestingModule = await buildModule();

        const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
        expect(storageService).toBeInstanceOf(expectedService);
      });
    });

    describeS3('S3 Storage Case Handling', () => {
      it('should handle S3 configuration with different case', async () => {
        configValues.STORAGE_TYPE = 'S3';
        configValues.S3_BUCKET_NAME = 'test-bucket';
        configValues.AWS_REGION = 'us-east-1';
        configValues.AWS_ACCESS_KEY_ID = 'test-key';
        configValues.AWS_SECRET_ACCESS_KEY = 'test-secret';
  
        const module: TestingModule = await buildModule();
  
        const storageService = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
        expect(storageService).toBeInstanceOf(S3StorageService);
      });
    });
  });

  describe('Service Singleton Behavior', () => {
    it('should return the same instance when requested multiple times', async () => {
      configValues.STORAGE_TYPE = 'local';
      
      const module: TestingModule = await buildModule();

      const storageService1 = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      const storageService2 = module.get<FileStorageService>('FILE_STORAGE_SERVICE');
      
      expect(storageService1).toBe(storageService2);
    });
  });
});
