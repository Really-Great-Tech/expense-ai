import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { FileStorageService, FileMetadata } from '../interfaces/file-storage.interface';

@Injectable()
export class LocalStorageService implements FileStorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  constructor(private configService: ConfigService) {}

  async uploadFile(buffer: Buffer, key: string, metadata?: Record<string, string>): Promise<string> {
    try {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const filePath = path.join(uploadPath, key);

      // Ensure full directory path exists (including nested directories)
      await this.ensureDirectory(path.dirname(filePath));

      // Write file to disk
      fs.writeFileSync(filePath, buffer);

      this.logger.log(`File uploaded to local storage: ${filePath}`);

      // Return logical key, not full path - this enables storage-agnostic code
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}:`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const filePath = path.join(uploadPath, key);
      
      const exists = (fs.existsSync as any)?.(filePath);
      if (exists === false) {
        throw new Error(`File not found: ${filePath}`);
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      this.logger.error(`Failed to download file ${key}:`, error);
      throw error;
    }
  }

  async getFileInfo(key: string): Promise<{size: number, exists: boolean}> {
    try {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const filePath = path.join(uploadPath, key);
      
      if (fs.existsSync(filePath) === false) {
        return { size: 0, exists: false };
      }
      
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        exists: true
      };
    } catch (error) {
      this.logger.error(`Failed to get file info for ${key}:`, error);
      return { size: 0, exists: false };
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const filePath = path.join(uploadPath, key);
      return fs.existsSync(filePath);
    } catch (error) {
      this.logger.error(`Failed to check file existence for ${key}:`, error);
      return false;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const filePath = path.join(uploadPath, key);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw error;
    }
  }

  async saveResult(key: string, data: any): Promise<void> {
    try {
      const outputPath = path.isAbsolute(key) ? key : key;
      await this.ensureDirectory(path.dirname(outputPath));
      
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
      
      this.logger.log(`Result saved to: ${outputPath}`);
    } catch (error) {
      this.logger.error(`Failed to save result ${key}:`, error);
      throw error;
    }
  }

  async loadResult(key: string): Promise<any> {
    try {
      const filePath = path.isAbsolute(key) ? key : key;
      
      const exists = (fs.existsSync as any)?.(filePath);
      if (exists === false) {
        throw new Error(`Result file not found: ${filePath}`);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to load result ${key}:`, error);
      throw error;
    }
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.logger.log(`Directory created: ${dirPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      // Ensure source file exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }
      
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await this.ensureDirectory(destDir);
      
      // Move file
      fs.renameSync(sourcePath, destPath);
      this.logger.log(`File moved from ${sourcePath} to ${destPath}`);
    } catch (error) {
      this.logger.error(`Failed to move file from ${sourcePath} to ${destPath}:`, error);
      throw error;
    }
  }

  async readFile(key: string): Promise<Buffer> {
    return this.downloadFile(key);
  }

  async readFileAsString(key: string): Promise<string> {
    try {
      const buffer = await this.readFile(key);
      return buffer.toString('utf8');
    } catch (error) {
      this.logger.error(`Failed to read file as string ${key}:`, error);
      throw error;
    }
  }

  // Additional methods for validation results and markdown extractions
  async saveValidationResult(key: string, data: any): Promise<void> {
    try {
      const outputPath = path.isAbsolute(key) ? key : key;
      await this.ensureDirectory(path.dirname(outputPath));
      
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
      
      this.logger.log(`Validation result saved to: ${outputPath}`);
    } catch (error) {
      this.logger.error(`Failed to save validation result ${key}:`, error);
      throw error;
    }
  }

  async saveMarkdownExtraction(key: string, content: string): Promise<void> {
    try {
      const outputPath = path.isAbsolute(key) ? key : key;
      await this.ensureDirectory(path.dirname(outputPath));
      
      fs.writeFileSync(outputPath, content, 'utf8');
      
      this.logger.log(`Markdown content saved to: ${outputPath}`);
    } catch (error) {
      this.logger.error(`Failed to save markdown extraction ${key}:`, error);
      throw error;
    }
  }

  // Helper method for reading local config files (schemas, compliance data)
  async readLocalConfigFile(relativePath: string): Promise<any> {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Config file not found: ${fullPath}`);
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to read config file ${relativePath}:`, error);
      throw error;
    }
  }

  // Helper method for file validation (from validation.utils.ts)
  async validateLocalFile(filePath: string): Promise<boolean> {
    try {
      const normalizedPath = path.resolve(filePath);
      
      if (!fs.existsSync(normalizedPath)) {
        return false;
      }
      
      const stats = fs.statSync(normalizedPath);
      return stats.isFile();
    } catch (error) {
      this.logger.error(`Failed to validate file ${filePath}:`, error);
      return false;
    }
  }
}
