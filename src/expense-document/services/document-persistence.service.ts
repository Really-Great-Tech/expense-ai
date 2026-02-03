import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ExpenseDocument, DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { Receipt, ReceiptStatus } from '@/expense-document/entities/receipt.entity';
import { Country } from '@/country-policy/entities/country.entity';
import { InvoiceGroup } from '../types/upload.types';
import { StorageMetadata } from '@/storage/s3-storage.service';

export interface ReceiptCreationData {
  group: InvoiceGroup;
  storageDetails: StorageMetadata;
  sourceDocumentId: string;
}

export interface SingleReceiptCreationData {
  storageDetails: StorageMetadata;
  sourceDocumentId: string;
  fileName: string;
  fileSize: number;
}

@Injectable()
export class DocumentPersistenceService {
  private readonly logger = new Logger(DocumentPersistenceService.name);

  constructor(
    @InjectRepository(ExpenseDocument)
    private readonly expenseDocumentRepository: Repository<ExpenseDocument>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) { }

  async createOrGetExpenseDocument(file: Express.Multer.File, options: any): Promise<ExpenseDocument> {
    const idempotencyKey = options.userId;
    let expenseDocument = await this.expenseDocumentRepository.findOne({
      where: { idempotencyKey },
    });

    if (expenseDocument) {
      this.logger.log(`Found existing document with idempotency key`, {
        id: expenseDocument.id,
        status: expenseDocument.status,
      });
      return expenseDocument;
    }

    let countryEntity = null;
    if (options.country) {
      countryEntity = await this.countryRepository.findOne({
        where: { name: options.country },
      });
    }

    expenseDocument = this.expenseDocumentRepository.create({
      idempotencyKey,
      originalFileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: DocumentStatus.UPLOADED,
      uploadedBy: options.userId || 'anonymous',
      country: options.country || 'Unknown',
      icp: options.icp || 'DEFAULT',
      countryId: countryEntity?.id || null,
      totalPages: 0,
      totalReceipts: 0,
      storageKey: '',
      storageBucket: '',
      storageType: 'local',
      storageUrl: null,
      processingMetadata: {
        uploadedAt: new Date().toISOString(),
        originalRequest: { ...options },
      },
    });

    expenseDocument = await this.expenseDocumentRepository.save(expenseDocument);
    this.logger.log(`Created new ExpenseDocument`, { id: expenseDocument.id });

    return expenseDocument;
  }

  async updateDocumentStatus(document: ExpenseDocument, status: DocumentStatus, updates?: Partial<ExpenseDocument>): Promise<void> {
    await this.expenseDocumentRepository.update(document.id, {
      status,
      ...updates,
      updatedAt: new Date(),
    });
    document.status = status;
    if (updates) Object.assign(document, updates);
  }

  async createReceiptsInTransaction(receiptsData: ReceiptCreationData[]): Promise<Receipt[]> {
    return await this.expenseDocumentRepository.manager.transaction(async (manager) => {
      const receiptRepository = manager.getRepository(Receipt);
      const receipts: Receipt[] = [];

      for (const data of receiptsData) {
        const receipt = receiptRepository.create({
          sourceDocumentId: data.sourceDocumentId,
          storageKey: data.storageDetails.storageKey,
          storageBucket: data.storageDetails.storageBucket,
          storageType: data.storageDetails.storageType,
          storageUrl: data.storageDetails.storageUrl,
          fileName: data.group.fileName,
          fileSize: data.group.fileSize,
          status: ReceiptStatus.CREATED,
          extractedText: data.group.content,
          metadata: {
            receiptNumber: data.group.invoiceNumber,
            pageNumbers: data.group.pages,
            totalPages: data.group.pages.length,
            splitConfidence: data.group.confidence,
            splitReasoning: data.group.reasoning,
          },
        });

        const savedReceipt = await receiptRepository.save(receipt);
        receipts.push(savedReceipt);
      }

      return receipts;
    });
  }

  async updateReceiptStatus(receiptId: string, status: ReceiptStatus, metadata?: any): Promise<void> {
    const updates: any = { status };
    if (metadata) {
      // Merge with existing metadata to preserve receiptNumber, pageNumbers, etc.
      const existingReceipt = await this.receiptRepository.findOne({ where: { id: receiptId } });
      const existingMetadata = existingReceipt?.metadata || {};
      updates.metadata = { ...existingMetadata, ...metadata };
    }
    await this.receiptRepository.update(receiptId, updates);
  }

  async getReceiptsByDocumentId(documentId: string): Promise<Receipt[]> {
    return await this.receiptRepository.find({
      where: { sourceDocumentId: documentId },
    });
  }

  /**
   * Get an ExpenseDocument by ID
   */
  async getExpenseDocumentById(documentId: string): Promise<ExpenseDocument | null> {
    return await this.expenseDocumentRepository.findOne({
      where: { id: documentId },
    });
  }

  /**
   * Get a receipt by ID with its extracted text
   */
  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    return await this.receiptRepository.findOne({
      where: { id: receiptId },
    });
  }

  /**
   * Create a single receipt from a document that doesn't require splitting
   * Used by the single-receipt endpoint
   */
  async createSingleReceipt(data: SingleReceiptCreationData): Promise<Receipt> {
    return await this.expenseDocumentRepository.manager.transaction(async (manager) => {
      const receiptRepository = manager.getRepository(Receipt);

      const receipt = receiptRepository.create({
        sourceDocumentId: data.sourceDocumentId,
        storageKey: data.storageDetails.storageKey,
        storageBucket: data.storageDetails.storageBucket,
        storageType: data.storageDetails.storageType,
        storageUrl: data.storageDetails.storageUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        status: ReceiptStatus.CREATED,
        extractedText: '', // Will be populated during receipt processing
        metadata: {
          receiptNumber: 1,
          pageNumbers: [1],
          totalPages: 1,
          splitConfidence: 1.0,
          splitReasoning: 'Single receipt upload (no splitting required)',
          singleReceiptFastPath: true,
        },
      });

      const savedReceipt = await receiptRepository.save(receipt);
      this.logger.log(`Created single receipt`, { receiptId: savedReceipt.id });

      return savedReceipt;
    });
  }

  private computeIdempotencyKey(file: Express.Multer.File, userId?: string): string {
    const content = file.buffer.toString('base64') + (userId || '') + file.originalname;
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
