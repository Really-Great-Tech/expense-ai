import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { FileStorageService, FileMetadata } from '../interfaces/file-storage.interface';

@Injectable()
export class S3StorageService implements FileStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    
    this.bucketName = this.configService.get('S3_BUCKET_NAME');
    
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME is required for S3StorageService');
    }
    
    this.logger.log(`S3StorageService initialized with bucket: ${this.bucketName}`);
  }

  async uploadFile(buffer: Buffer, key: string, metadata?: Record<string, string>): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: this.getContentType(key),
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      const s3Url = `s3://${this.bucketName}/${key}`;
      this.logger.log(`File uploaded to S3: ${s3Url}`);

      // Return logical key, not full S3 URL - this enables storage-agnostic code
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload file ${key} to S3:`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error(`No body returned for file ${key}`);
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      this.logger.log(`File downloaded from S3: ${key} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${key} from S3:`, error);
      throw error;
    }
  }

  async getFileInfo(key: string): Promise<{size: number, exists: boolean}> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      return {
        size: response.ContentLength || 0,
        exists: true
      };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return { size: 0, exists: false };
      }
      
      this.logger.error(`Failed to get file info for ${key}:`, error);
      return { size: 0, exists: false };
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const info = await this.getFileInfo(key);
      return info.exists;
    } catch (error) {
      this.logger.error(`Failed to check file existence for ${key}:`, error);
      return false;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key} from S3:`, error);
      throw error;
    }
  }

  async saveResult(key: string, data: any): Promise<void> {
    try {
      const resultKey = `results/${key}`;
      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData, 'utf8');

      await this.uploadFile(buffer, resultKey, {
        'content-type': 'application/json',
        'result-type': 'processing-result'
      });
      
      this.logger.log(`Result saved to S3: ${resultKey}`);
    } catch (error) {
      this.logger.error(`Failed to save result ${key} to S3:`, error);
      throw error;
    }
  }

  async loadResult(key: string): Promise<any> {
    try {
      const resultKey = `results/${key}`;
      const buffer = await this.downloadFile(resultKey);
      const content = buffer.toString('utf8');
      
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to load result ${key} from S3:`, error);
      throw error;
    }
  }

  async ensureDirectory(path: string): Promise<void> {
    // S3 doesn't have directories, so this is a no-op
    // But we keep the interface for compatibility
    this.logger.debug(`Directory operation not needed for S3: ${path}`);
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    try {
      // For S3, we copy the object and then delete the source
      // First, download the source file
      const buffer = await this.downloadFile(sourcePath);
      
      // Upload to destination
      await this.uploadFile(buffer, destPath);
      
      // Delete source
      await this.deleteFile(sourcePath);
      
      this.logger.log(`File moved in S3 from ${sourcePath} to ${destPath}`);
    } catch (error) {
      this.logger.error(`Failed to move file in S3 from ${sourcePath} to ${destPath}:`, error);
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
      const validationKey = `validation_results/${key}`;
      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData, 'utf8');

      await this.uploadFile(buffer, validationKey, {
        'content-type': 'application/json',
        'result-type': 'validation-result'
      });
      
      this.logger.log(`Validation result saved to S3: ${validationKey}`);
    } catch (error) {
      this.logger.error(`Failed to save validation result ${key} to S3:`, error);
      throw error;
    }
  }

  async saveMarkdownExtraction(key: string, content: string): Promise<void> {
    try {
      const markdownKey = `markdown_extractions/${key}`;
      const buffer = Buffer.from(content, 'utf8');

      await this.uploadFile(buffer, markdownKey, {
        'content-type': 'text/markdown',
        'result-type': 'markdown-extraction'
      });
      
      this.logger.log(`Markdown content saved to S3: ${markdownKey}`);
    } catch (error) {
      this.logger.error(`Failed to save markdown extraction ${key} to S3:`, error);
      throw error;
    }
  }

  // Helper method for reading config files - S3 version would load from S3
  async readLocalConfigFile(relativePath: string): Promise<any> {
    try {
      // For S3 implementation, we might load config from S3 or keep it local
      // For now, we'll attempt to load from S3 configs/ prefix
      const configKey = `configs/${relativePath}`;
      
      try {
        const content = await this.readFileAsString(configKey);
        return JSON.parse(content);
      } catch (s3Error) {
        // Fallback to reading from local filesystem for configs
        this.logger.warn(`Config not found in S3 (${configKey}), this might be expected for schemas/compliance data`);
        throw new Error(`Config file not found in S3: ${configKey}`);
      }
    } catch (error) {
      this.logger.error(`Failed to read config file ${relativePath}:`, error);
      throw error;
    }
  }

  // Helper method for file validation
  async validateLocalFile(filePath: string): Promise<boolean> {
    try {
      // For S3, we interpret filePath as an S3 key
      return await this.fileExists(filePath);
    } catch (error) {
      this.logger.error(`Failed to validate S3 file ${filePath}:`, error);
      return false;
    }
  }

  // Helper method to determine content type based on file extension
  private getContentType(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      case 'json':
        return 'application/json';
      case 'md':
        return 'text/markdown';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  // Utility method to get S3 URL for external access
  getS3Url(key: string): string {
    return `s3://${this.bucketName}/${key}`;
  }

  // Utility method to extract key from S3 URL
  extractKeyFromUrl(s3Url: string): string {
    if (s3Url.startsWith('s3://')) {
      const parts = s3Url.replace('s3://', '').split('/');
      return parts.slice(1).join('/'); // Remove bucket name, keep the rest as key
    }
    return s3Url; // Assume it's already a key
  }
}
