import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorageService } from '../interfaces/file-storage.interface';
import * as fs from 'fs';
import * as path from 'path';

export interface PhysicalPathResult {
  path: string;
  isTemp: boolean;
}

export interface StorageMetadata {
  storageKey: string;
  storageBucket: string;
  storageType: 'local' | 's3';
  storageUrl: string;
}

/**
 * StorageResolverService - Abstracts file storage operations
 *
 * This service provides a unified interface for file operations regardless of storage backend.
 * It handles the complexity of downloading S3 files to temp locations when needed,
 * and ensures the application code doesn't need to know about storage implementation details.
 */
@Injectable()
export class StorageResolverService {
  private readonly logger = new Logger(StorageResolverService.name);

  constructor(
    @Inject('FILE_STORAGE_SERVICE')
    private readonly storageService: FileStorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get file buffer from storage (works for both local and S3)
   * @param storageKey - Logical storage key (e.g., "splits/user_123/doc-id/file.pdf")
   * @returns File buffer
   */
  async getFile(storageKey: string): Promise<Buffer> {
    const storageType = this.getStorageType();

    this.logger.debug(`Getting file from ${storageType} storage: ${storageKey}`);

    if (storageType === 'local') {
      // For local, prepend UPLOAD_PATH to get full path
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const fullPath = path.join(uploadPath, storageKey);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found in local storage: ${fullPath}`);
      }

      return fs.readFileSync(fullPath);
    } else {
      // For S3, download using storage service
      return await this.storageService.downloadFile(storageKey);
    }
  }

  /**
   * Get physical file path for document readers and processors
   * Downloads S3 files to temp location if needed
   *
   * @param storageKey - Logical storage key
   * @returns Object with file path and flag indicating if it's temporary
   */
  async getPhysicalPath(storageKey: string): Promise<PhysicalPathResult> {
    const storageType = this.getStorageType();

    this.logger.debug(`Resolving physical path for ${storageType} storage: ${storageKey}`);

    if (storageType === 'local') {
      // Return actual file path - no download needed
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const fullPath = path.join(uploadPath, storageKey);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found in local storage: ${fullPath}`);
      }

      this.logger.debug(`Local file path: ${fullPath}`);
      return { path: fullPath, isTemp: false };
    } else {
      // Download from S3 to temp location
      this.logger.log(`Downloading S3 file to temp location: ${storageKey}`);

      const fileBuffer = await this.storageService.downloadFile(storageKey);
      const tempDir = this.configService.get('UPLOAD_PATH', './uploads');

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, `temp_${Date.now()}_${path.basename(storageKey)}`);
      fs.writeFileSync(tempPath, fileBuffer);

      this.logger.debug(`Downloaded to temp file: ${tempPath}`);
      return { path: tempPath, isTemp: true };
    }
  }

  /**
   * Cleanup temporary file
   * @param filePath - Path to temp file
   */
  cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp file ${filePath}:`, error);
      // Don't throw - cleanup failures shouldn't break the flow
    }
  }

  /**
   * Build storage metadata for a given key
   * @param storageKey - Logical storage key
   * @returns Complete storage metadata
   */
  buildStorageMetadata(storageKey: string): StorageMetadata {
    const storageType = this.getStorageType();
    const storageBucket = this.getStorageBucket();
    const storageUrl = this.buildStorageUrl(storageKey, storageType, storageBucket);

    return {
      storageKey,
      storageBucket,
      storageType,
      storageUrl,
    };
  }

  /**
   * Build storage URL based on storage type
   * @param key - Storage key
   * @param type - Storage type ('local' or 's3')
   * @param bucket - Storage bucket (or 'local' for local storage)
   * @returns Full storage URL
   */
  private buildStorageUrl(key: string, type: 'local' | 's3', bucket: string): string {
    if (type === 's3') {
      return `s3://${bucket}/${key}`;
    } else {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      return path.join(uploadPath, key);
    }
  }

  /**
   * Get current storage type from config
   * @returns 'local' or 's3'
   */
  getStorageType(): 'local' | 's3' {
    const storageTypeRaw = this.configService.get('STORAGE_TYPE', 'local');
    return (storageTypeRaw ?? 'local').toString().toLowerCase() as 'local' | 's3';
  }

  /**
   * Get storage bucket name
   * @returns Bucket name for S3, or 'local' for local storage
   */
  getStorageBucket(): string {
    const storageType = this.getStorageType();
    if (storageType === 's3') {
      return this.configService.get('S3_BUCKET_NAME', 'default-bucket');
    }
    return 'local';
  }

  /**
   * Check if a file exists in storage
   * @param storageKey - Logical storage key
   * @returns True if file exists
   */
  async fileExists(storageKey: string): Promise<boolean> {
    const storageType = this.getStorageType();

    if (storageType === 'local') {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const fullPath = path.join(uploadPath, storageKey);
      return fs.existsSync(fullPath);
    } else {
      return await this.storageService.fileExists(storageKey);
    }
  }
}
