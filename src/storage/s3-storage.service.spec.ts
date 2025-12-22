import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';
import { CircuitBreakerService } from '../resilience';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'PutObject' })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'GetObject' })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'DeleteObject' })),
  HeadObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'HeadObject' })),
}));

describe('S3StorageService', () => {
  let service: S3StorageService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockCircuitBreakerService: jest.Mocked<CircuitBreakerService>;
  let mockS3Send: jest.Mock;

  const mockAppConfig = {
    aws: { region: 'eu-west-1' },
    storage: { s3BucketName: 'test-bucket' },
  };

  beforeEach(async () => {
    mockS3Send = jest.fn();

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'app') return mockAppConfig;
        return undefined;
      }),
    } as any;

    const mockBreaker = {
      execute: jest.fn().mockImplementation((fn) => fn()),
    };

    mockCircuitBreakerService = {
      getS3Breaker: jest.fn().mockReturnValue(mockBreaker),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CircuitBreakerService, useValue: mockCircuitBreakerService },
      ],
    }).compile();

    service = module.get<S3StorageService>(S3StorageService);
    // Access private s3Client and mock send
    (service as any).s3Client.send = mockS3Send;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should throw error when S3_BUCKET_NAME is not set', async () => {
      const invalidConfig = {
        get: jest.fn((key: string) => {
          if (key === 'app') return { aws: { region: 'eu-west-1' }, storage: { s3BucketName: undefined } };
          return undefined;
        }),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            S3StorageService,
            { provide: ConfigService, useValue: invalidConfig },
            { provide: CircuitBreakerService, useValue: mockCircuitBreakerService },
          ],
        }).compile(),
      ).rejects.toThrow('S3_BUCKET_NAME is required for S3StorageService');
    });
  });

  describe('uploadFile', () => {
    it('should upload file to S3', async () => {
      mockS3Send.mockResolvedValue({});
      const buffer = Buffer.from('test content');
      const key = 'test/file.txt';

      const result = await service.uploadFile(buffer, key);

      expect(result).toBe(key);
      expect(mockCircuitBreakerService.getS3Breaker).toHaveBeenCalled();
    });

    it('should upload file with metadata', async () => {
      mockS3Send.mockResolvedValue({});
      const buffer = Buffer.from('test content');
      const key = 'test/file.txt';
      const metadata = { source: 'test' };

      const result = await service.uploadFile(buffer, key, metadata);

      expect(result).toBe(key);
    });

    it('should throw error on upload failure', async () => {
      mockS3Send.mockRejectedValue(new Error('Upload failed'));
      const buffer = Buffer.from('test content');

      await expect(service.uploadFile(buffer, 'test/file.txt')).rejects.toThrow('Upload failed');
    });
  });

  describe('downloadFile', () => {
    it('should download file from S3', async () => {
      const mockContent = Buffer.from('test content');
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield mockContent;
        },
      };
      mockS3Send.mockResolvedValue({ Body: mockStream });

      const result = await service.downloadFile('test/file.txt');

      expect(result).toEqual(mockContent);
    });

    it('should throw error when no body returned', async () => {
      mockS3Send.mockResolvedValue({ Body: null });

      await expect(service.downloadFile('test/file.txt')).rejects.toThrow('No body returned for file');
    });

    it('should throw error on download failure', async () => {
      mockS3Send.mockRejectedValue(new Error('Download failed'));

      await expect(service.downloadFile('test/file.txt')).rejects.toThrow('Download failed');
    });
  });

  describe('getFile', () => {
    it('should be an alias for downloadFile', async () => {
      const mockContent = Buffer.from('test content');
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield mockContent;
        },
      };
      mockS3Send.mockResolvedValue({ Body: mockStream });

      const result = await service.getFile('test/file.txt');

      expect(result).toEqual(mockContent);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockS3Send.mockResolvedValue({ ContentLength: 100 });

      const result = await service.fileExists('test/file.txt');

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const error = new Error('Not Found');
      (error as any).name = 'NotFound';
      mockS3Send.mockRejectedValue(error);

      const result = await service.fileExists('test/file.txt');

      expect(result).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    it('should return file info when file exists', async () => {
      mockS3Send.mockResolvedValue({ ContentLength: 1024 });

      const result = await service.getFileInfo('test/file.txt');

      expect(result).toEqual({ size: 1024, exists: true });
    });

    it('should return not exists for 404 error', async () => {
      const error = new Error('Not Found');
      (error as any).$metadata = { httpStatusCode: 404 };
      mockS3Send.mockRejectedValue(error);

      const result = await service.getFileInfo('test/file.txt');

      expect(result).toEqual({ size: 0, exists: false });
    });

    it('should return not exists for other errors', async () => {
      mockS3Send.mockRejectedValue(new Error('Some error'));

      const result = await service.getFileInfo('test/file.txt');

      expect(result).toEqual({ size: 0, exists: false });
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3', async () => {
      mockS3Send.mockResolvedValue({});

      await expect(service.deleteFile('test/file.txt')).resolves.not.toThrow();
    });

    it('should throw error on delete failure', async () => {
      mockS3Send.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteFile('test/file.txt')).rejects.toThrow('Delete failed');
    });
  });

  describe('uploadOriginalDocument', () => {
    it('should upload document with correct key structure', async () => {
      mockS3Send.mockResolvedValue({});
      const buffer = Buffer.from('document content');

      const result = await service.uploadOriginalDocument(buffer, 'document.pdf', 'doc-123', 'user-456');

      expect(result.storageKey).toBe('documents/user-456/doc-123/document.pdf');
      expect(result.storageDetails.storageBucket).toBe('test-bucket');
      expect(result.storageDetails.storageType).toBe('s3');
    });
  });

  describe('uploadOriginalFile', () => {
    it('should upload file with correct key structure', async () => {
      mockS3Send.mockResolvedValue({});
      const mockFile = {
        buffer: Buffer.from('file content'),
        originalname: 'receipt.jpg',
      } as Express.Multer.File;

      const result = await service.uploadOriginalFile(mockFile, 'doc-123', 'user-456');

      expect(result.storagePath).toBe('receipts/user-456/doc-123/receipt.jpg');
      expect(result.storageDetails.storageBucket).toBe('test-bucket');
    });
  });

  describe('saveResult', () => {
    it('should save result to S3 with results/ prefix', async () => {
      mockS3Send.mockResolvedValue({});
      const data = { foo: 'bar' };

      await service.saveResult('test-key', data);

      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should throw error on save failure', async () => {
      mockS3Send.mockRejectedValue(new Error('Save failed'));

      await expect(service.saveResult('test-key', {})).rejects.toThrow('Save failed');
    });
  });

  describe('loadResult', () => {
    it('should load and parse JSON result from S3', async () => {
      const mockData = { foo: 'bar' };
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify(mockData));
        },
      };
      mockS3Send.mockResolvedValue({ Body: mockStream });

      const result = await service.loadResult('test-key');

      expect(result).toEqual(mockData);
    });
  });

  describe('saveValidationResult', () => {
    it('should save validation result with validation_results/ prefix', async () => {
      mockS3Send.mockResolvedValue({});
      const data = { valid: true };

      await service.saveValidationResult('test-key', data);

      expect(mockS3Send).toHaveBeenCalled();
    });
  });

  describe('saveMarkdownExtraction', () => {
    it('should save markdown content with markdown_extractions/ prefix', async () => {
      mockS3Send.mockResolvedValue({});
      const content = '# Test Markdown';

      await service.saveMarkdownExtraction('test-key', content);

      expect(mockS3Send).toHaveBeenCalled();
    });
  });

  describe('readFile', () => {
    it('should be an alias for downloadFile', async () => {
      const mockContent = Buffer.from('test content');
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield mockContent;
        },
      };
      mockS3Send.mockResolvedValue({ Body: mockStream });

      const result = await service.readFile('test/file.txt');

      expect(result).toEqual(mockContent);
    });
  });

  describe('readFileAsString', () => {
    it('should read file and return as UTF-8 string', async () => {
      const mockContent = 'test string content';
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(mockContent);
        },
      };
      mockS3Send.mockResolvedValue({ Body: mockStream });

      const result = await service.readFileAsString('test/file.txt');

      expect(result).toBe(mockContent);
    });

    it('should throw error on read failure', async () => {
      mockS3Send.mockRejectedValue(new Error('Read failed'));

      await expect(service.readFileAsString('test/file.txt')).rejects.toThrow('Read failed');
    });
  });

  describe('readLocalConfigFile', () => {
    it('should read and parse JSON config from S3', async () => {
      const mockConfig = { setting: 'value' };
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify(mockConfig));
        },
      };
      mockS3Send.mockResolvedValue({ Body: mockStream });

      const result = await service.readLocalConfigFile('settings.json');

      expect(result).toEqual(mockConfig);
    });

    it('should throw error when config not found', async () => {
      mockS3Send.mockRejectedValue(new Error('Not found'));

      await expect(service.readLocalConfigFile('missing.json')).rejects.toThrow();
    });
  });

  describe('buildStorageMetadata', () => {
    it('should build correct storage metadata', () => {
      const result = service.buildStorageMetadata('test/key.txt');

      expect(result).toEqual({
        storageKey: 'test/key.txt',
        storageBucket: 'test-bucket',
        storageType: 's3',
        storageUrl: 's3://test-bucket/test/key.txt',
      });
    });
  });

  describe('getStorageBucket', () => {
    it('should return bucket name', () => {
      const result = service.getStorageBucket();

      expect(result).toBe('test-bucket');
    });
  });

  describe('getS3Url', () => {
    it('should return correct S3 URL', () => {
      const result = service.getS3Url('test/key.txt');

      expect(result).toBe('s3://test-bucket/test/key.txt');
    });
  });

  describe('extractKeyFromUrl', () => {
    it('should extract key from S3 URL', () => {
      const result = service.extractKeyFromUrl('s3://test-bucket/test/key.txt');

      expect(result).toBe('test/key.txt');
    });

    it('should return input if not S3 URL', () => {
      const result = service.extractKeyFromUrl('test/key.txt');

      expect(result).toBe('test/key.txt');
    });
  });

  describe('getContentType (private method via uploadFile)', () => {
    it.each([
      ['file.pdf', 'application/pdf'],
      ['file.jpg', 'image/jpeg'],
      ['file.jpeg', 'image/jpeg'],
      ['file.png', 'image/png'],
      ['file.tiff', 'image/tiff'],
      ['file.tif', 'image/tiff'],
      ['file.json', 'application/json'],
      ['file.md', 'text/markdown'],
      ['file.txt', 'text/plain'],
      ['file.unknown', 'application/octet-stream'],
    ])('should return correct content type for %s', async (filename, expectedContentType) => {
      mockS3Send.mockResolvedValue({});
      const buffer = Buffer.from('test');

      await service.uploadFile(buffer, filename);

      // Verify the PutObjectCommand was created with correct content type
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: expectedContentType,
        }),
      );
    });
  });
});
