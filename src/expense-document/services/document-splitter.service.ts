import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SplitAnalysisResponse } from '../types/upload.types';
import { ExpenseDocument, DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { Receipt } from '@/expense-document/entities/receipt.entity';
import { DuplicateDetectionService, DuplicateCheckResult } from '@/utils/duplicate-detection.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { ProcessingQueueService } from './processing-queue.service';
import { QUEUE_NAMES, DocumentSplittingJobData } from '@/common/types';

@Injectable()
export class DocumentSplitterService {
  private readonly logger = new Logger(DocumentSplitterService.name);

  constructor(
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly s3Storage: S3StorageService,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly queueService: ProcessingQueueService,
    @InjectQueue(QUEUE_NAMES.DOCUMENT_SPLITTING)
    private readonly splitterQueue: Queue<DocumentSplittingJobData>,
  ) {}

  /**
   * Analyze and split document asynchronously via background queue
   * Steps A-C run synchronously, Steps D-I run in background queue
   * Returns immediately after enqueuing the job
   */
  async analyzeAndSplitDocumentAsync(
    file: Express.Multer.File,
    options: {
      documentReader?: string;
      userId?: string;
      country?: string;
      icp?: string;
      forceResplit?: boolean;
      duplicateChoice?: 'REFERENCE_EXISTING' | 'FORCE_REPROCESS';
    },
  ): Promise<SplitAnalysisResponse> {
    let expenseDocument: ExpenseDocument;
    let duplicateResult: DuplicateCheckResult | null = null;

    try {
      this.logger.log(`Starting async document analysis for file: ${file.originalname}`, {
        userId: options.userId,
        fileSize: file.size,
      });

      // STEP A: Check for duplicates first
      duplicateResult = await this.duplicateDetectionService.checkForDuplicates({
        fileBuffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        userId: options.userId,
      });

      if (duplicateResult.isDuplicate && !options.forceResplit) {
        this.logger.log(`Duplicate detected: ${duplicateResult.duplicateType}`, {
          existingDocumentId: duplicateResult.existingDocument?.id,
          confidence: duplicateResult.confidence,
        });

        if (options.duplicateChoice === 'REFERENCE_EXISTING') {
          return await this.handleDuplicateReference(duplicateResult);
        } else if (options.duplicateChoice === 'FORCE_REPROCESS') {
          this.logger.log('User chose to force reprocess duplicate');
        } else {
          return this.buildDuplicateChoiceResponse(duplicateResult);
        }
      }

      // STEP B: Create or get ExpenseDocument
      expenseDocument = await this.persistenceService.createOrGetExpenseDocument(file, options);

      if (expenseDocument.status === DocumentStatus.COMPLETED && !options.forceResplit) {
        const existingReceipts = await this.persistenceService.getReceiptsByDocumentId(expenseDocument.id);
        return this.buildResponseFromExisting(expenseDocument, existingReceipts);
      }

      // STEP C: Set PROCESSING status and upload original file to S3
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.PROCESSING);

      const { storageKey: originalStorageKey, storageDetails: originalStorageDetails } = await this.s3Storage.uploadOriginalDocument(
        file.buffer,
        file.originalname,
        expenseDocument.id,
        options.userId || 'anonymous',
      );

      // Update document with storage info
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.BOUNDARY_DETECTION, {
        storageKey: originalStorageKey,
        storageBucket: originalStorageDetails.storageBucket,
        storageType: originalStorageDetails.storageType,
        storageUrl: originalStorageDetails.storageUrl,
      });

      // ENQUEUE: Steps D-I run in background queue
      const jobData: DocumentSplittingJobData = {
        documentId: expenseDocument.id,
        storageKey: originalStorageKey,
        storageBucket: originalStorageDetails.storageBucket,
        storageType: originalStorageDetails.storageType as 'local' | 's3',
        originalFileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId: options.userId || 'anonymous',
        country: options.country || 'Unknown',
        icp: options.icp || 'DEFAULT',
        documentReader: options.documentReader,
      };

      await this.splitterQueue.add(QUEUE_NAMES.DOCUMENT_SPLITTING, jobData, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      });

      this.logger.log(`Document splitting job enqueued`, {
        expenseDocumentId: expenseDocument.id,
      });

      // Store file hash for future duplicate detection
      if (duplicateResult) {
        await this.duplicateDetectionService.storeFileHash({
          hash: duplicateResult.contentHash,
          originalFilename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          documentId: expenseDocument.id,
        });
      }

      // Return immediately with documentId - processing happens in background
      return {
        success: true,
        data: {
          originalFileName: file.originalname,
          expenseDocumentId: expenseDocument.id,
          status: 'QUEUED' as const,
        },
      };
    } catch (error) {
      this.logger.error('Async document analysis failed:', error, {
        expenseDocumentId: expenseDocument?.id,
      });

      if (expenseDocument) {
        await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.FAILED, {
          processingMetadata: {
            ...expenseDocument.processingMetadata,
            error: error.message,
            failedAt: new Date().toISOString(),
          },
        });
      }

      throw error;
    }
  }

  private async handleDuplicateReference(duplicateResult: DuplicateCheckResult): Promise<SplitAnalysisResponse> {
    const existingDocument = duplicateResult.existingDocument!;
    const existingReceipts = await this.persistenceService.getReceiptsByDocumentId(existingDocument.id);

    this.logger.log(`Referencing existing document ${existingDocument.id} with ${existingReceipts.length} receipts`);

    return {
      success: true,
      data: {
        originalFileName: existingDocument.originalFileName,
        totalPages: existingDocument.totalPages,
        hasMultipleInvoices: existingReceipts.length > 1,
        totalInvoices: existingReceipts.length,
        invoices: existingReceipts.map((receipt) => ({
          invoiceNumber: receipt.metadata?.receiptNumber || 0,
          pages: receipt.metadata?.pageNumbers || [],
          content: receipt.extractedText || '',
          confidence: receipt.metadata?.splitConfidence || 1.0,
          reasoning: 'Referenced from existing duplicate',
          totalPages: receipt.metadata?.totalPages || 1,
          pdfPath: null,
          fileName: receipt.fileName,
          fileSize: receipt.fileSize,
          storagePath: receipt.storageUrl || receipt.storageKey,
          receiptId: receipt.id,
        })),
        expenseDocumentId: existingDocument.id,
        receiptIds: existingReceipts.map((r) => r.id),
        isDuplicate: true,
        duplicateAction: 'REFERENCED',
      },
    };
  }

  private buildDuplicateChoiceResponse(duplicateResult: DuplicateCheckResult): SplitAnalysisResponse {
    return {
      success: false,
      requiresUserChoice: true,
      duplicateInfo: {
        isDuplicate: true,
        duplicateType: duplicateResult.duplicateType!,
        existingDocument: duplicateResult.existingDocument,
        confidence: duplicateResult.confidence,
        recommendation: duplicateResult.recommendation,
        choices: [
          {
            action: 'REFERENCE_EXISTING',
            label: 'Use existing results',
            description: 'Reference the existing document and its processed receipts',
          },
          {
            action: 'FORCE_REPROCESS',
            label: 'Process anyway',
            description: 'Create a new document and process it separately',
          },
        ],
      },
      data: null,
    };
  }

  private buildResponseFromExisting(document: ExpenseDocument, receipts: Receipt[]): SplitAnalysisResponse {
    const invoiceGroups = receipts.map((receipt) => ({
      invoiceNumber: receipt.metadata?.receiptNumber || 0,
      pages: receipt.metadata?.pageNumbers || [],
      content: receipt.extractedText || '',
      confidence: receipt.metadata?.splitConfidence || 1.0,
      reasoning: receipt.metadata?.splitReasoning || 'Previously processed',
      totalPages: receipt.metadata?.totalPages || 1,
      pdfPath: null,
      fileName: receipt.fileName,
      fileSize: receipt.fileSize,
      storagePath: receipt.storageUrl || receipt.storageKey,
      receiptId: receipt.id,
    }));

    return {
      success: true,
      data: {
        originalFileName: document.originalFileName,
        totalPages: document.totalPages,
        hasMultipleInvoices: receipts.length > 1,
        totalInvoices: receipts.length,
        invoices: invoiceGroups,
        expenseDocumentId: document.id,
        receiptIds: receipts.map((r) => r.id),
      },
    };
  }

  /**
   * Process a single receipt without splitting
   * Fast-path that skips Textract OCR, LLM boundary detection, and PDF splitting
   * @param file Uploaded file
   * @param options Processing options
   * @returns Processing response with single receipt
   */
  async processSingleReceipt(
    file: Express.Multer.File,
    options: {
      documentReader?: string;
      userId?: string;
      country?: string;
      icp?: string;
    },
  ): Promise<SplitAnalysisResponse> {
    let expenseDocument: ExpenseDocument;

    try {
      this.logger.log(`Processing single receipt (fast-path): ${file.originalname}`, {
        userId: options.userId,
        fileSize: file.size,
      });

      // STEP A: Create ExpenseDocument
      expenseDocument = await this.persistenceService.createOrGetExpenseDocument(file, options);

      // Check if already processed
      if (expenseDocument.status === DocumentStatus.COMPLETED) {
        const existingReceipts = await this.persistenceService.getReceiptsByDocumentId(expenseDocument.id);
        if (existingReceipts.length > 0) {
          return this.buildResponseFromExisting(expenseDocument, existingReceipts);
        }
      }

      // STEP B: Set PROCESSING status
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.PROCESSING, {
        totalPages: 1,
        processingMetadata: {
          ...expenseDocument.processingMetadata,
          singleReceiptFastPath: true,
          startedAt: new Date().toISOString(),
        },
      });

      // STEP C: Upload original file directly (no splitting)
      const { storagePath, storageDetails } = await this.s3Storage.uploadOriginalFile(
        file,
        expenseDocument.id,
        options.userId || 'anonymous',
      );

      // STEP D: Create single receipt entity
      const receipt = await this.persistenceService.createSingleReceipt({
        storageDetails,
        sourceDocumentId: expenseDocument.id,
        fileName: file.originalname,
        fileSize: file.size,
      });

      // STEP E: Update document completion
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.COMPLETED, {
        totalReceipts: 1,
        processingMetadata: {
          ...expenseDocument.processingMetadata,
          completedAt: new Date().toISOString(),
          totalReceipts: 1,
          singleReceiptFastPath: true,
        },
      });

      // STEP F: Enqueue receipt for downstream processing
      await this.queueService.enqueueReceiptProcessing([receipt], options);

      this.logger.log(`Single receipt processing completed (fast-path)`, {
        expenseDocumentId: expenseDocument.id,
        receiptId: receipt.id,
      });

      return {
        success: true,
        data: {
          originalFileName: file.originalname,
          totalPages: 1,
          hasMultipleInvoices: false,
          totalInvoices: 1,
          invoices: [
            {
              invoiceNumber: 1,
              pages: [1],
              content: '',
              confidence: 1.0,
              reasoning: 'Single receipt upload (no splitting required)',
              totalPages: 1,
              pdfPath: null,
              fileName: file.originalname,
              fileSize: file.size,
              storagePath: storagePath,
              receiptId: receipt.id,
            },
          ],
          expenseDocumentId: expenseDocument.id,
          receiptIds: [receipt.id],
        },
      };
    } catch (error) {
      this.logger.error(`Single receipt processing failed:`, error, {
        expenseDocumentId: expenseDocument?.id,
      });

      if (expenseDocument) {
        await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.FAILED, {
          processingMetadata: {
            ...expenseDocument.processingMetadata,
            error: error.message,
            failedAt: new Date().toISOString(),
          },
        });
      }

      throw error;
    }
  }
}
