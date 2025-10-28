import { ConfigService } from '@nestjs/config';
import { DocumentReaderFactory } from './documentReaderFactory';
import { DocumentReaderType } from './types';
import { TextractApiService } from './textractReader';

jest.mock('./textractReader');

describe('DocumentReaderFactory', () => {
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService = {
      get: jest.fn(),
    } as any;
  });

  describe('createReader', () => {
    it('should create Textract reader', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'AWS_SECRET_ACCESS_KEY': 'mock-secret',
          'AWS_REGION': 'us-east-1',
          'UPLOAD_PATH': './uploads',
        };
        return config[key] || defaultValue;
      });

      const reader = DocumentReaderFactory.createReader(
        DocumentReaderType.TEXTRACT,
        'mock-access-key',
        mockConfigService
      );

      expect(reader).toBeInstanceOf(TextractApiService);
      expect(mockConfigService.get).toHaveBeenCalledWith('AWS_SECRET_ACCESS_KEY');
      expect(mockConfigService.get).toHaveBeenCalledWith('AWS_REGION');
      expect(mockConfigService.get).toHaveBeenCalledWith('UPLOAD_PATH', './uploads');
    });

    it('should create Textract reader with case-insensitive type', () => {
      mockConfigService.get.mockReturnValue('mock-value');

      const reader = DocumentReaderFactory.createReader(
        'TEXTRACT',
        'mock-access-key',
        mockConfigService
      );

      expect(reader).toBeInstanceOf(TextractApiService);
    });

    it('should throw error for unsupported reader type', () => {
      expect(() => {
        DocumentReaderFactory.createReader('unsupported-type', 'mock-api-key', mockConfigService);
      }).toThrow('Unsupported document reader type: unsupported-type');
    });

    it('should use default ConfigService if not provided', () => {
      const reader = DocumentReaderFactory.createReader(
        DocumentReaderType.TEXTRACT,
        'mock-access-key'
      );

      expect(reader).toBeInstanceOf(TextractApiService);
    });
  });

  describe('getDefaultReader', () => {
    it('should create reader with default Textract type', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'DOCUMENT_READER': undefined,
          'AWS_ACCESS_KEY_ID': 'mock-access-key',
          'AWS_SECRET_ACCESS_KEY': 'mock-secret',
          'AWS_REGION': 'us-east-1',
          'UPLOAD_PATH': './uploads',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const reader = DocumentReaderFactory.getDefaultReader(mockConfigService);

      expect(reader).toBeInstanceOf(TextractApiService);
    });

    it('should use DOCUMENT_READER from config if set', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'DOCUMENT_READER': 'textract',
          'AWS_ACCESS_KEY_ID': 'mock-access-key',
          'AWS_SECRET_ACCESS_KEY': 'mock-secret',
          'AWS_REGION': 'us-east-1',
          'UPLOAD_PATH': './uploads',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const reader = DocumentReaderFactory.getDefaultReader(mockConfigService);

      expect(reader).toBeInstanceOf(TextractApiService);
      expect(mockConfigService.get).toHaveBeenCalledWith('DOCUMENT_READER');
    });

    it('should use override type when provided', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'AWS_ACCESS_KEY_ID': 'mock-access-key',
          'AWS_SECRET_ACCESS_KEY': 'mock-secret',
          'AWS_REGION': 'us-east-1',
          'UPLOAD_PATH': './uploads',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const reader = DocumentReaderFactory.getDefaultReader(mockConfigService, 'textract');

      expect(reader).toBeInstanceOf(TextractApiService);
    });

    it('should throw error if AWS credentials not configured', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'DOCUMENT_READER': 'textract',
          'AWS_ACCESS_KEY_ID': undefined,
          'AWS_SECRET_ACCESS_KEY': undefined,
          'AWS_REGION': undefined,
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      expect(() => {
        DocumentReaderFactory.getDefaultReader(mockConfigService);
      }).toThrow('Textract AWS credentials not configured');
    });

    it('should throw error if access key missing', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'AWS_ACCESS_KEY_ID': undefined,
          'AWS_SECRET_ACCESS_KEY': 'mock-secret',
          'AWS_REGION': 'us-east-1',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      expect(() => {
        DocumentReaderFactory.getDefaultReader(mockConfigService);
      }).toThrow('Textract AWS credentials not configured');
    });

    it('should throw error for unsupported reader type', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'DOCUMENT_READER': 'unsupported',
          'AWS_ACCESS_KEY_ID': 'mock-access-key',
          'AWS_SECRET_ACCESS_KEY': 'mock-secret',
          'AWS_REGION': 'us-east-1',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      expect(() => {
        DocumentReaderFactory.getDefaultReader(mockConfigService);
      }).toThrow('Unsupported document reader type: unsupported');
    });

    it('should use environment credentials when available with default ConfigService', () => {
      // If environment variables are set, it should succeed
      // If not set, it will throw an error
      // This test just verifies the function can be called with default ConfigService
      try {
        const reader = DocumentReaderFactory.getDefaultReader();
        expect(reader).toBeInstanceOf(TextractApiService);
      } catch (error) {
        // If credentials aren't in environment, it should throw the expected error
        expect((error as Error).message).toBe('Textract AWS credentials not configured');
      }
    });
  });
});
