import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorageService } from '../interfaces/file-storage.interface';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
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
  private s3StorageService: S3StorageService | null = null;

  constructor(
    @Inject('FILE_STORAGE_SERVICE')
    private readonly storageService: FileStorageService,
    private readonly localStorageService: LocalStorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get file buffer from storage (works for both local and S3)
   * @param storageKey - Logical storage key (may be full S3 URL like s3://bucket/key)
   * @param storageType - Optional storage type override (uses config if not provided)
   * @returns File buffer
   */
  async getFile(storageKey: string, storageType?: 'local' | 's3'): Promise<Buffer> {
    // Use provided storageType or fall back to config
    const resolvedStorageType = storageType || this.getStorageType();
    
    // Extract actual key if it's a full S3 URL
    let actualStorageKey = storageKey;
    if (resolvedStorageType === 's3' || storageKey.startsWith('s3://')) {
      const bucket = storageType === 's3' ? this.getStorageBucket() : undefined;
      actualStorageKey = this.extractStorageKey(storageKey, bucket);
    }

    this.logger.debug(`Getting file from ${resolvedStorageType} storage: ${actualStorageKey}`);

    const service = this.getStorageService(resolvedStorageType);
    return await service.downloadFile(actualStorageKey);
  }

  /**
   * Get the appropriate storage service based on storage type
   * @param storageType - Storage type ('local' or 's3')
   * @returns The appropriate FileStorageService instance
   */
  private getStorageService(storageType: 'local' | 's3'): FileStorageService {
    if (storageType === 's3') {
      // Lazily create S3StorageService if needed (even if config says local)
      if (!this.s3StorageService) {
        this.logger.debug('Creating S3StorageService instance for runtime S3 access');
        this.s3StorageService = new S3StorageService(this.configService);
      }
      return this.s3StorageService;
    }
    return this.localStorageService;
  }

  /**
   * Extract the actual storage key from an S3 URL if it's a full URL
   * @param storageKey - Storage key (may be full S3 URL or just key)
   * @param bucket - Bucket name to extract from URL
   * @returns The actual storage key without the s3://bucket/ prefix
   */
  private extractStorageKey(storageKey: string, bucket?: string): string {
    // Check if it's a full S3 URL (s3://bucket/key)
    const s3UrlMatch = storageKey.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (s3UrlMatch) {
      const urlBucket = s3UrlMatch[1];
      const actualKey = s3UrlMatch[2];
      this.logger.debug(`Extracted storage key from S3 URL: ${actualKey} (bucket: ${urlBucket})`);
      return actualKey;
    }
    return storageKey;
  }

  /**
   * Get physical file path for document readers and processors
   * Downloads S3 files to temp location if needed
   *
   * @param storageKey - Logical storage key (may be full S3 URL like s3://bucket/key)
   * @param storageType - Optional storage type override (uses config if not provided)
   * @returns Object with file path and flag indicating if it's temporary
   */
  async getPhysicalPath(storageKey: string, storageType?: 'local' | 's3'): Promise<PhysicalPathResult> {
    // Use provided storageType or fall back to config
    const resolvedStorageType = storageType || this.getStorageType();
    
    // Extract actual key if it's a full S3 URL
    let actualStorageKey = storageKey;
    if (resolvedStorageType === 's3' || storageKey.startsWith('s3://')) {
      const bucket = storageType === 's3' ? this.getStorageBucket() : undefined;
      actualStorageKey = this.extractStorageKey(storageKey, bucket);
    }

    this.logger.debug(`Resolving physical path for ${resolvedStorageType} storage: ${actualStorageKey}`);

    if (resolvedStorageType === 'local') {
      // Return actual file path - no download needed
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const fullPath = path.join(uploadPath, actualStorageKey);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found in local storage: ${fullPath}`);
      }

      this.logger.debug(`Local file path: ${fullPath}`);
      return { path: fullPath, isTemp: false };
    } else {
      // Download from S3 to temp location
      this.logger.log(`Downloading S3 file to temp location: ${actualStorageKey}`);

      const service = this.getStorageService(resolvedStorageType);
      const fileBuffer = await service.downloadFile(actualStorageKey);
      const tempDir = this.configService.get('UPLOAD_PATH', './uploads');

      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, `temp_${Date.now()}_${path.basename(actualStorageKey)}`);
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
  async fileExists(storageKey: string, storageType?: 'local' | 's3'): Promise<boolean> {
    const resolvedStorageType = storageType || this.getStorageType();

    if (resolvedStorageType === 'local') {
      const uploadPath = this.configService.get('UPLOAD_PATH', 'uploads');
      const fullPath = path.join(uploadPath, storageKey);
      return fs.existsSync(fullPath);
    } else {
      const service = this.getStorageService(resolvedStorageType);
      return await service.fileExists(storageKey);
    }
  }
}
