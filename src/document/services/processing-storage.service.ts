import { Injectable, Logger, Inject } from '@nestjs/common';
import { FileStorageService } from '../../storage/interfaces/file-storage.interface';
import * as path from 'path';

@Injectable()
export class ProcessingStorageService {
  private readonly logger = new Logger(ProcessingStorageService.name);

  constructor(
    @Inject('FILE_STORAGE_SERVICE')
    private storageService: FileStorageService,
  ) {}

  async saveResults(filename: string, result: any): Promise<void> {
    try {
      const baseName = path.parse(filename).name;
      const outputFilename = `${baseName}_result.json`;

      await this.storageService.saveResult(outputFilename, result);

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

      await this.storageService.saveValidationResult(outputFilename, validationResult);

      this.logger.log(`LLM validation results saved using storage service: ${outputFilename}`);
    } catch (error) {
      this.logger.error(`Failed to save LLM validation results for ${filename}:`, error);
      // Don't throw error - saving is optional, don't fail the main process
    }
  }
}
