import { ConfigService } from '@nestjs/config';
import { DocumentReader, DocumentReaderType } from './types';
import { TextractApiService } from '../services/textract/textract-reader';

/**
 * Factory class for creating document readers
 * Uses AWS SDK default credential chain for authentication:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. Shared credentials file (~/.aws/credentials)
 * 3. ECS Container credentials (Task Role)
 * 4. EC2 Instance metadata (Instance Profile)
 */
export class DocumentReaderFactory {
  /**
   * Create a document reader based on the specified type
   * @param type The type of document reader to create
   * @param configService ConfigService instance for reading configuration
   * @returns A document reader instance
   */
  static createReader(type: string, configService: ConfigService = new ConfigService()): DocumentReader {
    switch (type.toLowerCase()) {
      case DocumentReaderType.TEXTRACT:
        return new TextractApiService({
          region: configService.get<string>('AWS_REGION'),
          uploadPath: configService.get<string>('UPLOAD_PATH', './uploads'),
        });
      default:
        throw new Error(`Unsupported document reader type: ${type}`);
    }
  }

  /**
   * Get the default document reader based on environment configuration
   * @param configService ConfigService instance for reading configuration
   * @param overrideType Optional reader type to override environment configuration
   * @returns A document reader instance
   */
  static getDefaultReader(configService: ConfigService = new ConfigService(), overrideType?: string): DocumentReader {
    const readerType = (overrideType || configService.get<string>('DOCUMENT_READER') || DocumentReaderType.TEXTRACT).toLowerCase();

    switch (readerType) {
      case DocumentReaderType.TEXTRACT:
        return new TextractApiService({
          region: configService.get<string>('AWS_REGION'),
          uploadPath: configService.get<string>('UPLOAD_PATH', './uploads'),
        });

      default:
        throw new Error(`Unsupported document reader type: ${readerType}`);
    }
  }
}
