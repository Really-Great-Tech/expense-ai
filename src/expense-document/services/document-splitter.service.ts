import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SplitAnalysisResponse } from '../types/upload.types';
import { ExpenseDocument, DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { Receipt } from '@/expense-document/entities/receipt.entity';
import { DuplicateDetectionService, DuplicateCheckResult } from '@/utils/duplicate-detection.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { QUEUE_NAMES, JOB_NAMES } from '@/common/constants/queue.constants';
import { SplitExpenseJobData } from '@/workflow/interfaces/workflow-job-data.interface';

@Injectable()
export class DocumentSplitterService {
  private readonly logger = new Logger(DocumentSplitterService.name);

  constructor(
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly s3Storage: S3StorageService,
    private readonly persistenceService: DocumentPersistenceService,
    @InjectQueue(QUEUE_NAMES.EXPENSE_WORKFLOW)
    private readonly workflowQueue: Queue<SplitExpenseJobData>,
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

      // // STEP A: Check for duplicates first
      // duplicateResult = await this.duplicateDetectionService.checkForDuplicates({
      //   fileBuffer: file.buffer,
      //   filename: file.originalname,
      //   mimeType: file.mimetype,
      //   userId: options.userId,
      // });

      // if (duplicateResult.isDuplicate && !options.forceResplit) {
      //   this.logger.log(`Duplicate detected: ${duplicateResult.duplicateType}`, {
      //     existingDocumentId: duplicateResult.existingDocument?.id,
      //     confidence: duplicateResult.confidence,
      //   });

      //   if (options.duplicateChoice === 'REFERENCE_EXISTING') {
      //     return await this.handleDuplicateReference(duplicateResult);
      //   } else if (options.duplicateChoice === 'FORCE_REPROCESS') {
      //     this.logger.log('User chose to force reprocess duplicate');
      //   } else {
      //     return this.buildDuplicateChoiceResponse(duplicateResult);
      //   }
      // }

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
      const jobData: SplitExpenseJobData = {
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

      await this.workflowQueue.add(JOB_NAMES.SPLIT_EXPENSE, jobData, {
        jobId: `split-${expenseDocument.id}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      });

      this.logger.log(`Document splitting job enqueued`, {
        expenseDocumentId: expenseDocument.id,
      });

      // // Store file hash for future duplicate detection
      // if (duplicateResult) {
      //   await this.duplicateDetectionService.storeFileHash({
      //     hash: duplicateResult.contentHash,
      //     originalFilename: file.originalname,
      //     fileSize: file.size,
      //     mimeType: file.mimetype,
      //     documentId: expenseDocument.id,
      //   });
      // }

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
}
