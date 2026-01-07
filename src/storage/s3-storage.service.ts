import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { AppConfigType } from '../config/app.config';
import { CircuitBreakerService } from '../resilience';

/**
 * Storage metadata returned when uploading documents
 */
export interface StorageMetadata {
  storageKey: string;
  storageBucket: string;
  storageType: 's3';
  storageUrl: string;
}

/**
 * S3StorageService - Unified S3 storage operations
 *
 * Provides all S3 storage functionality:
 * - Core S3 operations (upload, download, delete, exists)
 * - Document upload helpers (uploadOriginalDocument, uploadOriginalFile)
 * - Result storage (saveResult, saveValidationResult, saveMarkdownExtraction)
 * - Storage metadata helpers (buildStorageMetadata, getStorageBucket)
 */
@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly appConfig: AppConfigType;

  constructor(
    private configService: ConfigService,
    private circuitBreakerService: CircuitBreakerService,
  ) {
    // Get typed app config
    this.appConfig = this.configService.get<AppConfigType>('app')!;

    this.s3Client = new S3Client({
      region: this.appConfig.aws.region,
      maxAttempts: 4,
      retryMode: 'adaptive',
    });

    this.bucketName = this.appConfig.storage.s3BucketName!;

    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME is required for S3StorageService');
    }

    this.logger.log(`S3StorageService initialized with bucket: ${this.bucketName}`);
  }

  // ============================================
  // Core S3 Operations
  // ============================================

  async uploadFile(buffer: Buffer, key: string, metadata?: Record<string, string>): Promise<string> {
    const breaker = this.circuitBreakerService.getS3Breaker();

    try {
      return await breaker.execute(async () => {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: this.getContentType(key),
          Metadata: metadata,
        });

        await this.s3Client.send(command);
        this.logger.log(`File uploaded to S3: s3://${this.bucketName}/${key}`);
        return key;
      });
    } catch (error) {
      this.logger.error(`Failed to upload file ${key} to S3:`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    const breaker = this.circuitBreakerService.getS3Breaker();

    try {
      return await breaker.execute(async () => {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });

        const response = await this.s3Client.send(command);

        if (!response.Body) {
          throw new Error(`No body returned for file ${key}`);
        }

        const chunks: Buffer[] = [];
        const stream = response.Body as any;

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        this.logger.debug(`File downloaded from S3: ${key} (${buffer.length} bytes)`);
        return buffer;
      });
    } catch (error) {
      this.logger.error(`Failed to download file ${key} from S3:`, error);
      throw error;
    }
  }

  async getFileInfo(key: string): Promise<{ size: number; exists: boolean }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength || 0,
        exists: true,
      };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return { size: 0, exists: false };
      }

      this.logger.error(`Failed to get file info for ${key}:`, error);
      return { size: 0, exists: false };
    }
  }

  // ============================================
  // Document Upload Helpers
  // ============================================

  /**
   * Upload original document buffer to S3
   * Used by multi-receipt splitting flow
   */
  async uploadOriginalDocument(
    buffer: Buffer,
    fileName: string,
    expenseDocumentId: string,
    uploadedBy: string,
  ): Promise<{ storageKey: string; storageDetails: StorageMetadata }> {
    const key = `documents/${uploadedBy}/${expenseDocumentId}/${fileName}`;

    const storageKey = await this.uploadFile(buffer, key, {
      originalName: fileName,
      source: 'document-upload',
      documentId: expenseDocumentId,
    });

    const storageDetails = this.buildStorageMetadata(storageKey);
    this.logger.log(`Uploaded original document: ${storageKey}`);

    return { storageKey, storageDetails };
  }

  /**
   * Upload original file directly without splitting
   * Used by single-receipt fast-path
   */
  async uploadOriginalFile(
    file: Express.Multer.File,
    expenseDocumentId: string,
    uploadedBy: string,
  ): Promise<{ storagePath: string; storageDetails: StorageMetadata }> {
    const safeFileName = file.originalname;
    const key = `receipts/${uploadedBy}/${expenseDocumentId}/${safeFileName}`;

    const storageKey = await this.uploadFile(file.buffer, key, {
      originalName: safeFileName,
      source: 'single-receipt',
      parentDocument: expenseDocumentId,
    });

    const storageDetails = this.buildStorageMetadata(storageKey);
    this.logger.log(`Uploaded original file: ${storageKey}`);

    return { storagePath: storageKey, storageDetails };
  }

  // ============================================
  // Result Storage
  // ============================================

  async saveResult(key: string, data: any): Promise<void> {
    try {
      const resultKey = `results/${key}`;
      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData, 'utf8');

      await this.uploadFile(buffer, resultKey, {
        'content-type': 'application/json',
        'result-type': 'processing-result',
      });

      this.logger.log(`Result saved to S3: ${resultKey}`);
    } catch (error) {
      this.logger.error(`Failed to save result ${key} to S3:`, error);
      throw error;
    }
  }

  async saveValidationResult(key: string, data: any): Promise<void> {
    try {
      const validationKey = `validation_results/${key}`;
      const jsonData = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(jsonData, 'utf8');

      await this.uploadFile(buffer, validationKey, {
        'content-type': 'application/json',
        'result-type': 'validation-result',
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
        'result-type': 'markdown-extraction',
      });

      this.logger.log(`Markdown content saved to S3: ${markdownKey}`);
    } catch (error) {
      this.logger.error(`Failed to save markdown extraction ${key} to S3:`, error);
      throw error;
    }
  }

  // ============================================
  // Storage Metadata
  // ============================================

  /**
   * Build storage metadata for a given key
   */
  buildStorageMetadata(storageKey: string): StorageMetadata {
    return {
      storageKey,
      storageBucket: this.bucketName,
      storageType: 's3',
      storageUrl: `s3://${this.bucketName}/${storageKey}`,
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

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
}
