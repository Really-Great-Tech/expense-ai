import { Injectable, Logger } from '@nestjs/common';
import { PageMarkdown, PageAnalysisResult, SplitPdfInfo, InvoiceGroup, SplitAnalysisResponse } from './types/document-splitter.types';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { ExpenseDocument, DocumentStatus } from '@/document/entities/expense-document.entity';
import { Receipt } from '@/document/entities/receipt.entity';
import { DuplicateDetectionService, DuplicateCheckResult } from './services/duplicate-detection.service';
import { DocumentParsingService } from './services/document-parsing.service';
import { PdfSplittingService } from './services/pdf-splitting.service';
import { DocumentStorageService } from './services/document-storage.service';
import { DocumentPersistenceService, ReceiptCreationData } from './services/document-persistence.service';
import { ProcessingQueueService } from './services/processing-queue.service';

@Injectable()
export class DocumentSplitterService {
  private readonly logger = new Logger(DocumentSplitterService.name);

  constructor(
    private readonly documentSplitterAgent: DocumentSplitterAgent,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly parsingService: DocumentParsingService,
    private readonly splittingService: PdfSplittingService,
    private readonly storageService: DocumentStorageService,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly queueService: ProcessingQueueService,
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
    let tempDir: string | null = null;
    let expenseDocument: ExpenseDocument;
    let duplicateResult: DuplicateCheckResult | null = null;

    try {
      this.logger.log(`Starting document splitting for file: ${file.originalname}`, {
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

      // STEP C: Set PROCESSING status and create temp directory
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.PROCESSING);
      tempDir = this.storageService.getTempDirectory();
      const originalFilePath = await this.storageService.saveFileTemporarily(file, tempDir);

      // STEP D: Extract full document markdown
      const fullMarkdown = await this.parsingService.extractFullDocumentMarkdown(originalFilePath, 'textract');
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
      this.splittingService.validatePageAnalysis(pageAnalysis, pageMarkdowns.length);

      // STEP F: PDF splitting
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.SPLITTING);
      const splitPdfs = await this.splittingService.createSplitPdfFiles(originalFilePath, pageAnalysis, tempDir);
      const invoiceGroups = this.combineResultsWithPdfPaths(pageMarkdowns, pageAnalysis, splitPdfs);

      // STEP G: Upload splits and persist receipts
      const { receipts, uploadedGroups } = await this.uploadAndPersistReceipts(expenseDocument, invoiceGroups);

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

      this.logger.log(`Document splitting completed: ${receipts.length} receipts created`, {
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
          tempDirectory: tempDir,
          expenseDocumentId: expenseDocument.id,
          receiptIds: receipts.map((r) => r.id),
        },
      };
    } catch (error) {
      this.logger.error(`Document splitting failed:`, error, {
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

      if (tempDir) await this.storageService.cleanupTempDirectory(tempDir);
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

  private combineResultsWithPdfPaths(pageMarkdowns: PageMarkdown[], analysis: PageAnalysisResult, splitPdfs: SplitPdfInfo[]): InvoiceGroup[] {
    return analysis.pageGroups.map((group) => {
      const splitPdf = splitPdfs.find((pdf) => pdf.invoiceNumber === group.invoiceNumber);
      const combinedMarkdown = this.parsingService.combinePageMarkdown(pageMarkdowns, group.pages);

      return {
        invoiceNumber: group.invoiceNumber,
        pages: group.pages,
        content: combinedMarkdown,
        confidence: group.confidence,
        reasoning: group.reasoning,
        totalPages: group.pages.length,
        pdfPath: splitPdf?.pdfPath || null,
        fileName: splitPdf?.fileName || null,
        fileSize: splitPdf?.fileSize || null,
      };
    });
  }

  private async uploadAndPersistReceipts(
    expenseDocument: ExpenseDocument,
    invoiceGroups: InvoiceGroup[],
  ): Promise<{ receipts: Receipt[]; uploadedGroups: InvoiceGroup[] }> {
    const receiptsData: ReceiptCreationData[] = [];
    const uploadedGroups: InvoiceGroup[] = [];

    for (const group of invoiceGroups) {
      try {
        if (group.pdfPath) {
          const { storagePath, storageDetails } = await this.storageService.uploadSplitPdf(
            group.pdfPath,
            group.fileName || `invoice_${group.invoiceNumber}.pdf`,
            expenseDocument.id,
            expenseDocument.uploadedBy,
            group.invoiceNumber,
          );

          receiptsData.push({
            group,
            storageDetails,
            sourceDocumentId: expenseDocument.id,
          });

          uploadedGroups.push({
            ...group,
            storagePath,
          });
        }
      } catch (error) {
        this.logger.warn(`Upload failed for invoice ${group.invoiceNumber}:`, error);
      }
    }

    const receipts = await this.persistenceService.createReceiptsInTransaction(receiptsData);

    for (let i = 0; i < receipts.length; i++) {
      uploadedGroups[i].receiptId = receipts[i].id;
    }

    return { receipts, uploadedGroups };
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
      const { storagePath, storageDetails } = await this.storageService.uploadOriginalFile(
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

  async cleanupTempFiles(tempDirectory: string): Promise<void> {
    await this.storageService.cleanupTempDirectory(tempDirectory);
  }
}
