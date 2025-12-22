import { Injectable, Logger } from '@nestjs/common';
import { S3StorageService } from '@/storage/s3-storage.service';
import * as path from 'path';

@Injectable()
export class ProcessingStorageService {
  private readonly logger = new Logger(ProcessingStorageService.name);

  constructor(private readonly s3Storage: S3StorageService) {}

  async saveResults(filename: string, result: any): Promise<void> {
    try {
      const baseName = path.parse(filename).name;
      const outputFilename = `${baseName}_result.json`;

      await this.s3Storage.saveResult(outputFilename, result);

      this.logger.log(`Results saved using storage service: ${outputFilename}`);
    } catch (error) {
      this.logger.error(`Failed to save results for ${filename}:`, error);
      // Don't throw error - saving is optional, don't fail the main process
    }
  }

  async saveValidationResults(filename: string, validationResult: any): Promise<void> {
    try {
      const baseName = path.parse(filename).name;
      const outputFilename = `${baseName}_llm_validation.json`;

      await this.s3Storage.saveValidationResult(outputFilename, validationResult);

      this.logger.log(`LLM validation results saved using storage service: ${outputFilename}`);
    } catch (error) {
      this.logger.error(`Failed to save LLM validation results for ${filename}:`, error);
      // Don't throw error - saving is optional, don't fail the main process
    }
  }
}
