import { Test, TestingModule } from '@nestjs/testing';
import { FileValidationService } from './file-validation.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('FileValidationService', () => {
  let service: FileValidationService;
  let mockLogger: jest.Mocked<Logger>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileValidationService,
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FileValidationService>(FileValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFile', () => {
    it('should validate a valid PDF file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-invoice.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>'),
        size: 1024,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo.originalName).toBe('test-invoice.pdf');
      expect(result.fileInfo.mimeType).toBe('application/pdf');
      expect(result.fileInfo.detectedType).toBe('application/pdf');
      expect(result.fileInfo.size).toBe(1024);
    });

    it('should reject file with invalid MIME type', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        buffer: Buffer.from('This is a text file'),
        size: 19,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported file type: text/plain. Allowed types: application/pdf, image/png, image/jpeg, image/webp, application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should reject oversized files', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'huge-file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(100 * 1024 * 1024), // 100MB
        size: 100 * 1024 * 1024,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size 100MB exceeds maximum allowed size of 50MB');
      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'OVERSIZED',
          severity: 'MEDIUM',
          blocked: true,
        })
      );
    });

    it('should detect malicious patterns in filename', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: '../../../etc/passwd.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
        size: 8,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'SUSPICIOUS_FILENAME',
          severity: 'HIGH',
          description: 'Filename contains suspicious pattern',
        })
      );
    });

    it('should detect script injection in file content', async () => {
      const maliciousContent = Buffer.from('%PDF-1.4\n<script>alert("xss")</script>');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'malicious.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: maliciousContent,
        size: maliciousContent.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'MALICIOUS_PATTERN',
          severity: 'CRITICAL',
          description: expect.stringContaining('Script injection'),
        })
      );
    });

    it('should validate magic numbers for PDF files', async () => {
      const invalidPdfBuffer = Buffer.from('FAKE PDF CONTENT');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'fake.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: invalidPdfBuffer,
        size: invalidPdfBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File header does not match expected format for application/pdf');
    });

    it('should handle empty files', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'empty.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(0),
        size: 0,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty or missing');
    });

    it('should generate processing hints', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'complex-invoice.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>'),
        size: 10 * 1024 * 1024, // 10MB
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.processingHints).toContainEqual(
        expect.objectContaining({
          type: 'COMPLEXITY',
          value: 'HIGH',
        })
      );
    });

    it('should validate PNG files', async () => {
      // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'receipt.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: pngBuffer,
        size: pngBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.fileInfo.detectedType).toBe('image/png');
    });

    it('should validate JPEG files', async () => {
      // JPEG magic number: FF D8 FF
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'receipt.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: jpegBuffer,
        size: jpegBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.fileInfo.detectedType).toBe('image/jpeg');
    });
  });

  describe('validateBasicFile', () => {
    it('should pass for valid file input', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('content'),
        size: 7,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const validationResult = {
        isValid: false,
        errors: [],
        warnings: [],
        fileInfo: {
          originalName: mockFile.originalname,
          mimeType: mockFile.mimetype,
          size: mockFile.size,
          extension: '.pdf',
          detectedType: 'UNKNOWN'
        },
        securityFlags: [],
        processingHints: []
      };

      await service['validateBasicFile'](mockFile, validationResult);

      expect(validationResult.errors).toHaveLength(0);
    });

    it('should fail for missing originalname', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: '',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('content'),
        size: 7,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const validationResult = {
        isValid: false,
        errors: [],
        warnings: [],
        fileInfo: {
          originalName: mockFile.originalname,
          mimeType: mockFile.mimetype,
          size: mockFile.size,
          extension: '.pdf',
          detectedType: 'UNKNOWN'
        },
        securityFlags: [],
        processingHints: []
      };

      await service['validateBasicFile'](mockFile, validationResult);

      expect(validationResult.errors).toContain('File name is required');
    });
  });

  describe('security pattern detection', () => {
    it('should detect SQL injection patterns', async () => {
      const maliciousContent = Buffer.from("'; DROP TABLE users; --");
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: maliciousContent,
        size: maliciousContent.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.securityFlags.some(flag => 
        flag.type === 'MALICIOUS_PATTERN' && 
        flag.description.includes('SQL injection')
      )).toBe(true);
    });

    it('should detect system commands', async () => {
      const maliciousContent = Buffer.from('rm -rf /');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: maliciousContent,
        size: maliciousContent.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await service.validateFile(mockFile);

      expect(result.securityFlags.some(flag => 
        flag.type === 'MALICIOUS_PATTERN' && 
        flag.description.includes('System command')
      )).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle buffer reading errors gracefully', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: null, // Invalid buffer
        size: 1024,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      } as Express.Multer.File;

      const result = await service.validateFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty or missing');
    });
  });

  describe('performance considerations', () => {
    it('should complete validation within reasonable time', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      largeBuffer.write('%PDF-1.4', 0);
      
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: largeBuffer,
        size: largeBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const startTime = Date.now();
      const result = await service.validateFile(mockFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result).toBeDefined();
    });
  });
});
