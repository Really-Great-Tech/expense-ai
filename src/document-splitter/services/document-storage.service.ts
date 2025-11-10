import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorageService } from '@/storage/interfaces/file-storage.interface';
import { StorageResolverService } from '@/storage/services/storage-resolver.service';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface StorageDetails {
  storageKey: string;
  storageBucket: string;
  storageType: 'local' | 's3';
  storageUrl: string;
}

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);

  constructor(
    @Inject('FILE_STORAGE_SERVICE') private readonly storageService: FileStorageService,
    private readonly storageResolver: StorageResolverService,
    private readonly configService: ConfigService,
  ) {}

  getTempDirectory(): string {
    const tempDir = path.join(this.configService.get('UPLOAD_PATH', './uploads'), 'invoice-splits', Date.now().toString());

    const fsSync = require('fs');
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }

    return tempDir;
  }

  async saveFileTemporarily(file: Express.Multer.File, tempDir: string): Promise<string> {
    const filePath = path.join(tempDir, `original_${file.originalname}`);
    await fs.writeFile(filePath, file.buffer);

    this.logger.debug(`Saved temporary file: ${filePath}`);
    return filePath;
  }

  async uploadSplitPdf(
    pdfPath: string,
    fileName: string,
    expenseDocumentId: string,
    uploadedBy: string,
    invoiceNumber: number,
  ): Promise<{ storagePath: string; storageDetails: StorageDetails }> {
    const pdfBuffer = await fs.readFile(pdfPath);
    const safeFileName = fileName || `invoice_${invoiceNumber}.pdf`;
    const key = `splits/${uploadedBy}/${expenseDocumentId}/${safeFileName}`;

    // Upload returns logical key (same for both local and S3)
    const storageKey = await this.storageService.uploadFile(pdfBuffer, key, {
      originalName: safeFileName,
      source: 'document-splitter',
      parentDocument: expenseDocumentId,
      invoiceNumber: String(invoiceNumber),
    });

    // Build storage metadata using resolver
    const storageDetails = this.storageResolver.buildStorageMetadata(storageKey);

    this.logger.log(`Uploaded split PDF: ${storageKey} (${storageDetails.storageType})`);

    return { storagePath: storageKey, storageDetails };
  }

  /**
   * Upload original file directly without splitting
   * Used by single-receipt fast-path
   */
  async uploadOriginalFile(
    file: Express.Multer.File,
    expenseDocumentId: string,
    uploadedBy: string,
  ): Promise<{ storagePath: string; storageDetails: StorageDetails }> {
    const safeFileName = file.originalname;
    const key = `receipts/${uploadedBy}/${expenseDocumentId}/${safeFileName}`;

    // Upload returns logical key (same for both local and S3)
    const storageKey = await this.storageService.uploadFile(file.buffer, key, {
      originalName: safeFileName,
      source: 'single-receipt',
      parentDocument: expenseDocumentId,
    });

    // Build storage metadata using resolver
    const storageDetails = this.storageResolver.buildStorageMetadata(storageKey);

    this.logger.log(`Uploaded original file: ${storageKey} (${storageDetails.storageType})`);

    return { storagePath: storageKey, storageDetails };
  }

  async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      this.logger.debug(`Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }
}
