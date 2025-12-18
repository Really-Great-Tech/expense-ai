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
    it('should create Textract reader with region and upload path', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          AWS_REGION: 'us-east-1',
          UPLOAD_PATH: './uploads',
        };
        return config[key] || defaultValue;
      });

      const reader = DocumentReaderFactory.createReader(DocumentReaderType.TEXTRACT, mockConfigService);

      expect(reader).toBeInstanceOf(TextractApiService);
      expect(mockConfigService.get).toHaveBeenCalledWith('AWS_REGION');
      expect(mockConfigService.get).toHaveBeenCalledWith('UPLOAD_PATH', './uploads');
    });

    it('should create Textract reader with case-insensitive type', () => {
      mockConfigService.get.mockReturnValue('mock-value');

      const reader = DocumentReaderFactory.createReader('TEXTRACT', mockConfigService);

      expect(reader).toBeInstanceOf(TextractApiService);
    });

    it('should throw error for unsupported reader type', () => {
      expect(() => {
        DocumentReaderFactory.createReader('unsupported-type', mockConfigService);
      }).toThrow('Unsupported document reader type: unsupported-type');
    });

    it('should use default ConfigService if not provided', () => {
      const reader = DocumentReaderFactory.createReader(DocumentReaderType.TEXTRACT);

      expect(reader).toBeInstanceOf(TextractApiService);
    });
  });

  describe('getDefaultReader', () => {
    it('should create reader with default Textract type', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string | undefined> = {
          DOCUMENT_READER: undefined,
          AWS_REGION: 'us-east-1',
          UPLOAD_PATH: './uploads',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const reader = DocumentReaderFactory.getDefaultReader(mockConfigService);

      expect(reader).toBeInstanceOf(TextractApiService);
    });

    it('should use DOCUMENT_READER from config if set', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          DOCUMENT_READER: 'textract',
          AWS_REGION: 'us-east-1',
          UPLOAD_PATH: './uploads',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const reader = DocumentReaderFactory.getDefaultReader(mockConfigService);

      expect(reader).toBeInstanceOf(TextractApiService);
      expect(mockConfigService.get).toHaveBeenCalledWith('DOCUMENT_READER');
    });

    it('should use override type when provided', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          AWS_REGION: 'us-east-1',
          UPLOAD_PATH: './uploads',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const reader = DocumentReaderFactory.getDefaultReader(mockConfigService, 'textract');

      expect(reader).toBeInstanceOf(TextractApiService);
    });

    it('should throw error for unsupported reader type', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          DOCUMENT_READER: 'unsupported',
          AWS_REGION: 'us-east-1',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      expect(() => {
        DocumentReaderFactory.getDefaultReader(mockConfigService);
      }).toThrow('Unsupported document reader type: unsupported');
    });

    it('should use default ConfigService if not provided', () => {
      // Uses AWS SDK default credential chain - no explicit credentials needed
      const reader = DocumentReaderFactory.getDefaultReader();
      expect(reader).toBeInstanceOf(TextractApiService);
    });
  });
});
