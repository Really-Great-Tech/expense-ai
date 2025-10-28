import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentStorageService } from './document-storage.service';
import { FileStorageService } from '@/storage/interfaces/file-storage.interface';
import { StorageResolverService } from '@/storage/services/storage-resolver.service';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
jest.mock('fs');

describe('DocumentStorageService', () => {
  let service: DocumentStorageService;
  let storageService: jest.Mocked<FileStorageService>;
  let configService: jest.Mocked<ConfigService>;
  let storageResolver: jest.Mocked<StorageResolverService>;

  beforeEach(async () => {
    const mockStorageService = {
      uploadFile: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          UPLOAD_PATH: './uploads',
          AWS_S3_BUCKET: 'test-bucket',
        };
        return config[key] || defaultValue;
      }),
    };

    const mockStorageResolver = {
      buildStorageMetadata: jest.fn((key: string) => ({
        storageKey: key,
        storageBucket: 'test-bucket',
        storageType: 's3' as const,
        storageUrl: `https://test-bucket.s3.amazonaws.com/${key}`,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentStorageService,
        {
          provide: 'FILE_STORAGE_SERVICE',
          useValue: mockStorageService,
        },
        {
          provide: StorageResolverService,
          useValue: mockStorageResolver,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DocumentStorageService>(DocumentStorageService);
    storageService = module.get('FILE_STORAGE_SERVICE');
    storageResolver = module.get(StorageResolverService);
    configService = module.get(ConfigService);

    // Mock fs module
    require('fs').existsSync = jest.fn().mockReturnValue(false);
    require('fs').mkdirSync = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getTempDirectory', () => {
    it('should create and return temp directory path', () => {
      const result = service.getTempDirectory();

      expect(result).toContain('uploads/invoice-splits');
      expect(result).toMatch(/\/\d+$/); // Ends with timestamp
    });

    it('should create directory if it does not exist', () => {
      const mkdirSyncMock = require('fs').mkdirSync;
      
      service.getTempDirectory();

      expect(mkdirSyncMock).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should not recreate directory if it exists', () => {
      require('fs').existsSync = jest.fn().mockReturnValue(true);
      const mkdirSyncMock = require('fs').mkdirSync;

      service.getTempDirectory();

      expect(mkdirSyncMock).not.toHaveBeenCalled();
    });

    it('should use configured upload path', () => {
      const customConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'UPLOAD_PATH') return '/custom/path';
          return defaultValue;
        }),
      };

      const customService = new DocumentStorageService(
        storageService as any,
        storageResolver as any,
        customConfig as any
      );

      const result = customService.getTempDirectory();

      expect(result).toContain('/custom/path/invoice-splits');
    });
  });

  describe('saveFileTemporarily', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test content'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('should save file to temp directory', async () => {
      const tempDir = '/temp/dir';
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.saveFileTemporarily(mockFile, tempDir);

      expect(result).toBe('/temp/dir/original_test.pdf');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/temp/dir/original_test.pdf',
        mockFile.buffer
      );
    });

    it('should handle file write errors', async () => {
      const tempDir = '/temp/dir';
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      await expect(
        service.saveFileTemporarily(mockFile, tempDir)
      ).rejects.toThrow('Write failed');
    });

    it('should prefix filename with "original_"', async () => {
      const tempDir = '/temp';
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.saveFileTemporarily(mockFile, tempDir);

      expect(result).toContain('original_test.pdf');
    });
  });

  describe('uploadSplitPdf', () => {
    const mockPdfPath = '/temp/invoice.pdf';
    const mockFileName = 'invoice_001.pdf';
    const mockDocId = 'doc-123';
    const mockUserId = 'user-456';
    const mockInvoiceNumber = 1;

    beforeEach(() => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('pdf content'));
    });

    it('should upload PDF and return storage details', async () => {
      storageService.uploadFile.mockResolvedValue('splits/user-456/doc-123/invoice_001.pdf');

      const result = await service.uploadSplitPdf(
        mockPdfPath,
        mockFileName,
        mockDocId,
        mockUserId,
        mockInvoiceNumber
      );

      expect(fs.readFile).toHaveBeenCalledWith(mockPdfPath);
      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'splits/user-456/doc-123/invoice_001.pdf',
        {
          originalName: mockFileName,
          source: 'document-splitter',
          parentDocument: mockDocId,
          invoiceNumber: '1',
        }
      );
      expect(result.storagePath).toBe('splits/user-456/doc-123/invoice_001.pdf');
      expect(result.storageDetails).toEqual({
        storageKey: 'splits/user-456/doc-123/invoice_001.pdf',
        storageBucket: 'test-bucket',
        storageType: 's3',
        storageUrl: 'https://test-bucket.s3.amazonaws.com/splits/user-456/doc-123/invoice_001.pdf',
      });
    });

    it('should use default filename if not provided', async () => {
      storageService.uploadFile.mockResolvedValue('s3://test-bucket/key');

      await service.uploadSplitPdf(
        mockPdfPath,
        '',
        mockDocId,
        mockUserId,
        mockInvoiceNumber
      );

      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('invoice_1.pdf'),
        expect.any(Object)
      );
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(
        service.uploadSplitPdf(mockPdfPath, mockFileName, mockDocId, mockUserId, mockInvoiceNumber)
      ).rejects.toThrow('File not found');
    });

    it('should handle upload errors', async () => {
      storageService.uploadFile.mockRejectedValue(new Error('Upload failed'));

      await expect(
        service.uploadSplitPdf(mockPdfPath, mockFileName, mockDocId, mockUserId, mockInvoiceNumber)
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('cleanupTempDirectory', () => {
    it('should remove temp directory', async () => {
      const tempDir = '/temp/dir';
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      await service.cleanupTempDirectory(tempDir);

      expect(fs.rm).toHaveBeenCalledWith(tempDir, {
        recursive: true,
        force: true,
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const tempDir = '/temp/dir';
      (fs.rm as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(
        service.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow();
    });

    it('should log warning on cleanup failure', async () => {
      const tempDir = '/temp/dir';
      const warnSpy = jest.spyOn(service['logger'], 'warn');
      (fs.rm as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));

      await service.cleanupTempDirectory(tempDir);

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete upload workflow', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('pdf content'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(mockFile.buffer);
      storageService.uploadFile.mockResolvedValue('s3://bucket/key');
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      // Get temp directory
      const tempDir = service.getTempDirectory();
      expect(tempDir).toBeDefined();

      // Save file temporarily
      const tempPath = await service.saveFileTemporarily(mockFile, tempDir);
      expect(tempPath).toContain('original_test.pdf');

      // Upload to S3
      const uploadResult = await service.uploadSplitPdf(
        tempPath,
        'invoice.pdf',
        'doc-123',
        'user-456',
        1
      );
      expect(uploadResult.storagePath).toBeDefined();

      // Cleanup
      await service.cleanupTempDirectory(tempDir);
      expect(fs.rm).toHaveBeenCalled();
    });
  });
});
