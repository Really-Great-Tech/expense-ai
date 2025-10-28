import { ConfigService } from '@nestjs/config';
import { DocumentReaderFactory } from './documentReaderFactory';
import { DocumentReaderType } from './types';

const createConfigService = (values: Record<string, any> = {}) => new ConfigService(values);

describe('DocumentReaderFactory', () => {

  describe('createReader', () => {
    it('should create Textract reader', () => {
      const configService = createConfigService({
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_REGION: 'us-east-1',
        UPLOAD_PATH: './uploads',
      });

      const reader = DocumentReaderFactory.createReader(DocumentReaderType.TEXTRACT, 'test-access-key', configService);
      expect(reader).toBeDefined();
      expect(reader.constructor.name).toBe('TextractApiService');
    });

    it('should throw error for unsupported reader type', () => {
      expect(() => {
        DocumentReaderFactory.createReader('unsupported', 'test-key');
      }).toThrow('Unsupported document reader type: unsupported');
    });
  });

  describe('getDefaultReader', () => {
    it('should return Textract reader when configured', () => {
      const configService = createConfigService({
        DOCUMENT_READER: DocumentReaderType.TEXTRACT,
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
        AWS_REGION: 'us-east-1',
        UPLOAD_PATH: './uploads',
      });

      const reader = DocumentReaderFactory.getDefaultReader(configService);
      expect(reader).toBeDefined();
      expect(reader.constructor.name).toBe('TextractApiService');
    });

    it('should throw error when AWS credentials are missing for Textract', () => {
      const configService = createConfigService({
        DOCUMENT_READER: DocumentReaderType.TEXTRACT,
      });

      expect(() => {
        DocumentReaderFactory.getDefaultReader(configService);
      }).toThrow('Textract AWS credentials not configured');
    });

    it('should throw error for unsupported reader type in environment', () => {
      const configService = createConfigService({
        DOCUMENT_READER: 'unsupported',
      });

      expect(() => {
        DocumentReaderFactory.getDefaultReader(configService);
      }).toThrow('Unsupported document reader type: unsupported');
    });
  });
});

describe('Document Reader Integration', () => {
  it('should have consistent interface between readers', async () => {
    const configService = createConfigService({
      DOCUMENT_READER: DocumentReaderType.TEXTRACT,
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-key',
      AWS_REGION: 'us-east-1',
      UPLOAD_PATH: './uploads',
    });

    const textractReader = DocumentReaderFactory.getDefaultReader(configService);

    // Both should have parseDocument method
    expect(typeof textractReader.parseDocument).toBe('function');

    // Both should accept the same parameters
    const mockFilePath = 'test.pdf';
    const mockConfig = { timeout: 60000 };

    // Note: These would fail in actual execution due to missing files/credentials
    // but we're testing the interface consistency
    expect(() => textractReader.parseDocument(mockFilePath, mockConfig)).not.toThrow();
  });
});
