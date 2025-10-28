import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');

const MockS3Client = S3Client as jest.MockedClass<typeof S3Client>;

// Skip S3 tests in CI environment or when AWS credentials are not available
const shouldSkipS3Tests = process.env.CI === 'true' || !process.env.AWS_ACCESS_KEY_ID;
const describeS3 = shouldSkipS3Tests ? describe.skip : describe;

describeS3('S3StorageService', () => {
  let service: S3StorageService;
  let mockS3Client: jest.Mocked<S3Client>;
  let configService: jest.Mocked<ConfigService>;
  let configValues: Record<string, string | undefined>;

  beforeEach(async () => {
    configValues = {
      S3_BUCKET_NAME: 'test-bucket',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const value = configValues[key];
        return value !== undefined ? value : defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<S3StorageService>(S3StorageService);
    configService = module.get<ConfigService>(ConfigService) as jest.Mocked<ConfigService>;
    mockS3Client = MockS3Client.mock.instances[0] as jest.Mocked<S3Client>;

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const buffer = Buffer.from('test file content');
      const key = 'uploads/user1/test.pdf';
      const metadata = { userId: 'user1', originalName: 'test.pdf' };

      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"abcd1234"'
      });

      const result = await service.uploadFile(buffer, key, metadata);

      expect(result).toBe(key);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
            Metadata: metadata
          })
        })
      );
    });

    it('should handle upload failure', async () => {
      const buffer = Buffer.from('test file content');
      const key = 'uploads/user1/test.pdf';

      mockS3Client.send = jest.fn().mockRejectedValue(new Error('Upload failed'));

      await expect(service.uploadFile(buffer, key)).rejects.toThrow('Upload failed');
    });

    it('should detect content type from file extension', async () => {
      const buffer = Buffer.from('test image content');
      const key = 'uploads/user1/image.jpg';

      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"abcd1234"'
      });

      await service.uploadFile(buffer, key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: 'image/jpeg'
          })
        })
      );
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const testBuffer = Buffer.from('test file content');
      const mockStream = Readable.from([testBuffer]);

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: mockStream,
        ContentLength: testBuffer.length
      });

      const result = await service.downloadFile('uploads/test.pdf');

      expect(result).toEqual(testBuffer);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'uploads/test.pdf'
          })
        })
      );
    });

    it('should handle download failure', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue(new Error('File not found'));

      await expect(service.downloadFile('uploads/nonexistent.pdf')).rejects.toThrow('File not found');
    });

    it('should handle missing response body', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        ContentLength: 0
      });

      await expect(service.downloadFile('uploads/empty.pdf')).rejects.toThrow('No file body received from S3');
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        ContentLength: 1024,
        LastModified: new Date()
      });

      const exists = await service.fileExists('uploads/test.pdf');

      expect(exists).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'uploads/test.pdf'
          })
        })
      );
    });

    it('should return false when file does not exist', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 }
      });

      const exists = await service.fileExists('uploads/nonexistent.pdf');

      expect(exists).toBe(false);
    });

    it('should throw error for other S3 errors', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 }
      });

      await expect(service.fileExists('uploads/test.pdf')).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 204 }
      });

      await service.deleteFile('uploads/test.pdf');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'uploads/test.pdf'
          })
        })
      );
    });

    it('should handle delete failure', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteFile('uploads/test.pdf')).rejects.toThrow('Delete failed');
    });
  });

  describe('saveResult', () => {
    it('should save result as JSON successfully', async () => {
      const testData = { processed: true, results: ['item1', 'item2'] };
      
      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"abcd1234"'
      });

      await service.saveResult('results/test-result.json', testData);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'results/test-result.json',
            Body: JSON.stringify(testData, null, 2),
            ContentType: 'application/json'
          })
        })
      );
    });
  });

  describe('loadResult', () => {
    it('should load and parse JSON result successfully', async () => {
      const testData = { processed: true, results: ['item1', 'item2'] };
      const mockStream = Readable.from([Buffer.from(JSON.stringify(testData))]);

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: mockStream
      });

      const result = await service.loadResult('results/test-result.json');

      expect(result).toEqual(testData);
    });

    it('should throw error for invalid JSON', async () => {
      const mockStream = Readable.from([Buffer.from('invalid json')]);

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: mockStream
      });

      await expect(service.loadResult('results/test-result.json')).rejects.toThrow();
    });
  });

  describe('getFileInfo', () => {
    it('should return file info when file exists', async () => {
      const lastModified = new Date();
      mockS3Client.send = jest.fn().mockResolvedValue({
        ContentLength: 2048,
        LastModified: lastModified,
        ContentType: 'application/pdf'
      });

      const fileInfo = await service.getFileInfo('uploads/test.pdf');

      expect(fileInfo).toEqual({
        size: 2048,
        exists: true
      });
    });

    it('should return exists false when file does not exist', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 }
      });

      const fileInfo = await service.getFileInfo('uploads/nonexistent.pdf');

      expect(fileInfo).toEqual({
        size: 0,
        exists: false
      });
    });
  });

  describe('saveMarkdownExtraction', () => {
    it('should save markdown content successfully', async () => {
      const markdownContent = '# Test Markdown\n\nThis is test content.';
      
      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"abcd1234"'
      });

      await service.saveMarkdownExtraction('markdown/test.md', markdownContent);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'markdown/test.md',
            Body: markdownContent,
            ContentType: 'text/markdown'
          })
        })
      );
    });
  });

  describe('saveValidationResult', () => {
    it('should save validation result successfully', async () => {
      const validationData = { isValid: true, errors: [], score: 0.95 };
      
      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"abcd1234"'
      });

      await service.saveValidationResult('validation/test-validation.json', validationData);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'validation/test-validation.json',
            Body: JSON.stringify(validationData, null, 2),
            ContentType: 'application/json'
          })
        })
      );
    });
  });

  describe('readFile', () => {
    it('should read file as buffer successfully', async () => {
      const testBuffer = Buffer.from('test file content');
      const mockStream = Readable.from([testBuffer]);

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: mockStream
      });

      const result = await service.readFile('uploads/test.txt');

      expect(result).toEqual(testBuffer);
    });
  });

  describe('readFileAsString', () => {
    it('should read file as string successfully', async () => {
      const testContent = 'test file content';
      const mockStream = Readable.from([Buffer.from(testContent)]);

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: mockStream
      });

      const result = await service.readFileAsString('uploads/test.txt');

      expect(result).toBe(testContent);
    });
  });

  describe('readLocalConfigFile', () => {
    it('should read and parse config file successfully', async () => {
      const configData = { setting1: 'value1', setting2: 'value2' };
      const mockStream = Readable.from([Buffer.from(JSON.stringify(configData))]);

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: mockStream
      });

      const result = await service.readLocalConfigFile('config/app.json');

      expect(result).toEqual(configData);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'config/app.json'
          })
        })
      );
    });

    it('should return null when config file does not exist', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue({
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 }
      });

      const result = await service.readLocalConfigFile('config/nonexistent.json');

      expect(result).toBeNull();
    });
  });

  describe('validateLocalFile', () => {
    it('should return true for valid file', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        ContentLength: 1024,
        LastModified: new Date()
      });

      const isValid = await service.validateLocalFile('uploads/test.pdf');

      expect(isValid).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      mockS3Client.send = jest.fn().mockRejectedValue({
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 }
      });

      const isValid = await service.validateLocalFile('uploads/nonexistent.pdf');

      expect(isValid).toBe(false);
    });
  });

  describe('environment configuration', () => {
    it('should throw error when S3_BUCKET_NAME is not configured', async () => {
      const originalBucketName = configValues.S3_BUCKET_NAME;
      delete configValues.S3_BUCKET_NAME;

      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const value = configValues[key];
          return value !== undefined ? value : defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          S3StorageService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      expect(() => {
        module.get<S3StorageService>(S3StorageService);
      }).toThrow('S3_BUCKET_NAME is required for S3StorageService');

      // Restore the original value
      if (originalBucketName) {
        configValues.S3_BUCKET_NAME = originalBucketName;
      }
    });
  });

  describe('content type detection', () => {
    it('should detect various content types correctly', async () => {
      mockS3Client.send = jest.fn().mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        ETag: '"abcd1234"'
      });

      const testCases = [
        { key: 'test.pdf', expectedType: 'application/pdf' },
        { key: 'test.jpg', expectedType: 'image/jpeg' },
        { key: 'test.png', expectedType: 'image/png' },
        { key: 'test.json', expectedType: 'application/json' },
        { key: 'test.txt', expectedType: 'text/plain' },
        { key: 'test.md', expectedType: 'text/markdown' },
        { key: 'test.unknown', expectedType: 'application/octet-stream' }
      ];

      for (const testCase of testCases) {
        await service.uploadFile(Buffer.from('test'), testCase.key);
        
        expect(mockS3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              ContentType: testCase.expectedType
            })
          })
        );
      }
    });
  });
});
