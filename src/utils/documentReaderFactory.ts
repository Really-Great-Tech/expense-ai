import { ConfigService } from '@nestjs/config';
import { DocumentReader, DocumentReaderType } from './types';
import { TextractApiService } from './textractReader';

/**
 * Factory class for creating document readers
 */
export class DocumentReaderFactory {
  /**
   * Create a document reader based on the specified type
   * @param type The type of document reader to create
   * @param apiKey The API key for the document reader
   * @returns A document reader instance
   */
  static createReader(type: string, apiKey: string, configService: ConfigService = new ConfigService()): DocumentReader {
    switch (type.toLowerCase()) {
      case DocumentReaderType.TEXTRACT:
        return new TextractApiService({
          accessKeyId: apiKey,
          secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY'),
          region: configService.get<string>('AWS_REGION'),
          uploadPath: configService.get<string>('UPLOAD_PATH', './uploads'),
        });
      default:
        throw new Error(`Unsupported document reader type: ${type}`);
    }
  }

  /**
   * Get the default document reader based on environment configuration
   * @param overrideType Optional reader type to override environment configuration
   * @returns A document reader instance
   */
  static getDefaultReader(configService: ConfigService = new ConfigService(), overrideType?: string): DocumentReader {
    const readerType = (overrideType || configService.get<string>('DOCUMENT_READER') || DocumentReaderType.TEXTRACT).toLowerCase();

    switch (readerType) {
      case DocumentReaderType.TEXTRACT:
        // For Textract, we use service-specific AWS credentials from environment variables
        const textractAccessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
        const textractSecretAccessKey = configService.get<string>('AWS_SECRET_ACCESS_KEY');
        const textractRegion = configService.get<string>('AWS_REGION');

        if (!textractAccessKeyId || !textractSecretAccessKey || !textractRegion) {
          throw new Error('Textract AWS credentials not configured');
        }

        return new TextractApiService({
          accessKeyId: textractAccessKeyId,
          secretAccessKey: textractSecretAccessKey,
          region: textractRegion,
          uploadPath: configService.get<string>('UPLOAD_PATH', './uploads'),
        });

      default:
        throw new Error(`Unsupported document reader type: ${readerType}`);
    }
  }
}
