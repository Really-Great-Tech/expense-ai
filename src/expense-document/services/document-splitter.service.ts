import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PageMarkdown, PageAnalysisResult, InvoiceGroup, SplitAnalysisResponse } from '../types/upload.types';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { ExpenseDocument, DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { Receipt } from '@/expense-document/entities/receipt.entity';
import { DuplicateDetectionService, DuplicateCheckResult } from '@/utils/duplicate-detection.service';
import { DocumentParsingService } from '@/services/document-parsing/document-parsing.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService, ReceiptCreationData } from './document-persistence.service';
import { ProcessingQueueService } from './processing-queue.service';
import { QUEUE_NAMES, DocumentSplittingJobData } from '@/common/types';

@Injectable()
export class DocumentSplitterService {
  private readonly logger = new Logger(DocumentSplitterService.name);

  constructor(
    private readonly documentSplitterAgent: DocumentSplitterAgent,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly parsingService: DocumentParsingService,
    private readonly s3Storage: S3StorageService,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly queueService: ProcessingQueueService,
    @InjectQueue(QUEUE_NAMES.DOCUMENT_SPLITTING)
    private readonly splitterQueue: Queue<DocumentSplittingJobData>,
  ) {}

  async analyzeAndSplitDocument(
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
      this.logger.log(`Starting document analysis for file: ${file.originalname}`, {
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

      // Upload original file buffer to S3 (no temp files needed)
      const { storageKey: originalStorageKey, storageDetails: originalStorageDetails } =
        await this.s3Storage.uploadOriginalDocument(
          file.buffer,
          file.originalname,
          expenseDocument.id,
          options.userId || 'anonymous',
        );

      // Update document with storage info
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.PROCESSING, {
        storageKey: originalStorageKey,
        storageBucket: originalStorageDetails.storageBucket,
        storageType: originalStorageDetails.storageType,
        storageUrl: originalStorageDetails.storageUrl,
      });

      // STEP D: Extract full document markdown directly from buffer (no temp file)
      const fullMarkdown = await this.parsingService.extractMarkdownFromBuffer(file.buffer, file.originalname, 'textract');
      const pageMarkdowns = this.parsingService.parseMarkdownPages(fullMarkdown);

      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.TEXTRACT_COMPLETE, {
        totalPages: pageMarkdowns.length,
        processingMetadata: {
          ...expenseDocument.processingMetadata,
          textractCompleted: new Date().toISOString(),
          totalPages: pageMarkdowns.length,
        },
      });

      // STEP E: LLM boundary detection
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.BOUNDARY_DETECTION);
      const pageAnalysis = await this.documentSplitterAgent.analyzePages(pageMarkdowns);
      this.validatePageAnalysis(pageAnalysis, pageMarkdowns.length);

      // STEP F: Create invoice groups from page analysis (no PDF splitting - store markdown directly)
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.SPLITTING);
      const invoiceGroups = this.createInvoiceGroupsFromAnalysis(pageMarkdowns, pageAnalysis, file);

      // STEP G: Create receipts with markdown content (no split PDF uploads)
      const { receipts, uploadedGroups } = await this.createReceiptsFromGroups(expenseDocument, invoiceGroups, originalStorageDetails);

      // STEP H: Update document completion
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.COMPLETED, {
        totalReceipts: receipts.length,
        processingMetadata: {
          ...expenseDocument.processingMetadata,
          completedAt: new Date().toISOString(),
          totalReceipts: receipts.length,
          successfulUploads: receipts.length,
        },
      });

      // STEP I: Enqueue receipt processing
      await this.queueService.enqueueReceiptProcessing(receipts, options);

      // STEP J: Store file hash for future duplicate detection
      if (duplicateResult) {
        await this.duplicateDetectionService.storeFileHash({
          hash: duplicateResult.contentHash,
          originalFilename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          documentId: expenseDocument.id,
        });
      }

      this.logger.log(`Document analysis completed: ${receipts.length} receipts created`, {
        expenseDocumentId: expenseDocument.id,
        receiptIds: receipts.map((r) => r.id),
      });

      return {
        success: true,
        data: {
          originalFileName: file.originalname,
          totalPages: pageMarkdowns.length,
          hasMultipleInvoices: pageAnalysis.totalInvoices > 1,
          totalInvoices: pageAnalysis.totalInvoices,
          invoices: uploadedGroups,
          tempDirectory: '', // No temp directory used
          expenseDocumentId: expenseDocument.id,
          receiptIds: receipts.map((r) => r.id),
        },
      };
    } catch (error) {
      this.logger.error(`Document analysis failed:`, error, {
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

  /**
   * Validate page analysis results
   */
  private validatePageAnalysis(analysis: PageAnalysisResult, totalPages: number): void {
    if (!analysis || !analysis.pageGroups || analysis.pageGroups.length === 0) {
      throw new Error('Invalid page analysis: no page groups returned');
    }

    // Check all pages are covered
    const coveredPages = new Set<number>();
    for (const group of analysis.pageGroups) {
      for (const page of group.pages) {
        if (page < 1 || page > totalPages) {
          throw new Error(`Invalid page number ${page} in analysis (total pages: ${totalPages})`);
        }
        coveredPages.add(page);
      }
    }

    if (coveredPages.size !== totalPages) {
      this.logger.warn(`Page analysis doesn't cover all pages. Covered: ${coveredPages.size}, Total: ${totalPages}`);
    }
  }

  /**
   * Create invoice groups from page analysis (no PDF splitting)
   * Filters out Expensify cover pages and blank/error pages using both rule-based and LLM-enhanced detection
   */
  private createInvoiceGroupsFromAnalysis(
    pageMarkdowns: PageMarkdown[],
    analysis: PageAnalysisResult,
    file: Express.Multer.File,
  ): InvoiceGroup[] {
    // Filter out Expensify cover pages and blank/error pages
    const filteredGroups = analysis.pageGroups.filter((group) => {
      // Skip Expensify export/cover pages (rule-based)
      if (group.isExpensifyExport && group.expensifyConfidence && group.expensifyConfidence >= 0.5) {
        this.logger.log(`Skipping Expensify cover page group ${group.invoiceNumber} (rule-based confidence: ${group.expensifyConfidence})`);
        return false;
      }

      // Skip Expensify (LLM-enhanced via metadata)
      if (group.metadata?.isExpensifyPage && (group.metadata.expensifyConfidenceLlm || 0) >= 0.5) {
        this.logger.log(`Skipping Expensify cover page group ${group.invoiceNumber} (LLM confidence: ${group.metadata.expensifyConfidenceLlm})`);
        return false;
      }

      // Skip EXPENSE_COVER classified pages
      if (group.pageClassification === 'EXPENSE_COVER') {
        this.logger.log(`Skipping EXPENSE_COVER page group ${group.invoiceNumber}`);
        return false;
      }

      // Skip blank/error pages (rule-based)
      if (group.isBlankOrError) {
        this.logger.log(`Skipping blank/error page group ${group.invoiceNumber}: ${group.blankErrorReason}`);
        return false;
      }

      // Skip blank (LLM-enhanced via metadata)
      if (group.metadata?.isBlankLlm) {
        this.logger.log(`Skipping blank page group ${group.invoiceNumber} (LLM detected)`);
        return false;
      }

      return true;
    });

    this.logger.log(`Filtered ${analysis.pageGroups.length - filteredGroups.length} groups (Expensify/blank), keeping ${filteredGroups.length}`);

    // Re-number invoice groups after filtering
    return filteredGroups.map((group, index) => {
      const combinedMarkdown = this.parsingService.combinePageMarkdown(pageMarkdowns, group.pages);
      const estimatedFileSize = Math.round(file.size / Math.max(filteredGroups.length, 1));

      return {
        invoiceNumber: index + 1, // Re-number after filtering
        pages: group.pages,
        content: combinedMarkdown,
        confidence: group.confidence,
        reasoning: group.reasoning,
        totalPages: group.pages.length,
        pdfPath: null, // No split PDF created
        fileName: `invoice_${index + 1}_${file.originalname}`,
        fileSize: estimatedFileSize,
        // Preserve classification info
        isExpensifyExport: group.isExpensifyExport,
        expensifyConfidence: group.expensifyConfidence,
        expensifyReason: group.expensifyReason,
        expensifyIndicators: group.expensifyIndicators,
        isBlankOrError: group.isBlankOrError,
        blankErrorReason: group.blankErrorReason,
        pageClassification: group.pageClassification,
        // Rich metadata from LLM extraction
        merchantName: group.metadata?.merchantName,
        totalAmount: group.metadata?.totalAmount,
        currency: group.metadata?.currency,
        documentType: group.metadata?.documentType,
        transactionId: group.metadata?.transactionId,
        datePeriod: group.metadata?.datePeriod,
      };
    });
  }

  /**
   * Create receipts from invoice groups (no split PDF uploads)
   */
  private async createReceiptsFromGroups(
    expenseDocument: ExpenseDocument,
    invoiceGroups: InvoiceGroup[],
    originalStorageDetails: any,
  ): Promise<{ receipts: Receipt[]; uploadedGroups: InvoiceGroup[] }> {
    const receiptsData: ReceiptCreationData[] = [];
    const uploadedGroups: InvoiceGroup[] = [];

    for (const group of invoiceGroups) {
      // Create receipt data pointing to original document (no split PDF)
      receiptsData.push({
        group,
        storageDetails: {
          ...originalStorageDetails,
          // All receipts point to the same original document
          storageKey: originalStorageDetails.storageKey,
        },
        sourceDocumentId: expenseDocument.id,
      });

      uploadedGroups.push({
        ...group,
        storagePath: originalStorageDetails.storageKey,
      });
    }

    const receipts = await this.persistenceService.createReceiptsInTransaction(receiptsData);

    for (let i = 0; i < receipts.length; i++) {
      uploadedGroups[i].receiptId = receipts[i].id;
    }

    return { receipts, uploadedGroups };
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
        tempDirectory: '',
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
        tempDirectory: '',
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
          tempDirectory: '',
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

  /**
   * @deprecated No longer needed - temp files are not created
   */
  async cleanupTempFiles(_tempDirectory: string): Promise<void> {
    // No-op: temp files are no longer created
    this.logger.debug('cleanupTempFiles called but no temp files are created in new architecture');
  }
}
