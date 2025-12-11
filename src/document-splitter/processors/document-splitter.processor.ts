import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_TYPES, DocumentSplittingJobData, JobResult } from '../../types';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { DocumentParsingService } from '../services/document-parsing.service';
import { PdfSplittingService } from '../services/pdf-splitting.service';
import { DocumentStorageService } from '../services/document-storage.service';
import { DocumentPersistenceService, ReceiptCreationData } from '../services/document-persistence.service';
import { ProcessingQueueService } from '../services/processing-queue.service';
import { DocumentStatus } from '@/document/entities/expense-document.entity';
import { PageMarkdown, PageAnalysisResult, SplitPdfInfo, InvoiceGroup } from '../types/document-splitter.types';

/**
 * Document Splitter Processor
 *
 * Handles async document splitting jobs:
 * - Textract + Image conversion
 * - LLM boundary detection
 * - PDF splitting
 * - Upload splits + create receipts
 * - Enqueue receipt processing
 */
@Processor(QUEUE_NAMES.DOCUMENT_SPLITTING, {
  concurrency: 25, // 25 concurrent splits
  lockDuration: 600000, // 10 minutes - document splitting with Textract can take several minutes
  lockRenewTime: 30000, // Renew lock every 30 seconds
  stalledInterval: 60000, // Check for stalled jobs every 60 seconds
  maxStalledCount: 3, // Allow 3 stall checks before marking job as stalled
})
export class DocumentSplitterProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentSplitterProcessor.name);

  constructor(
    private readonly documentSplitterAgent: DocumentSplitterAgent,
    private readonly parsingService: DocumentParsingService,
    private readonly splittingService: PdfSplittingService,
    private readonly storageService: DocumentStorageService,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly queueService: ProcessingQueueService,
  ) {
    super();
  }

  async process(job: Job<DocumentSplittingJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { documentId, originalFilePath, tempDirectory, originalFileName, userId, country, icp, documentReader } =
      job.data;

    this.logger.log(`Starting document splitting for: ${originalFileName}`, {
      documentId,
      jobId: job.id,
    });

    try {
      // Load ExpenseDocument
      const expenseDocument = await this.persistenceService.getExpenseDocumentById(documentId);
      if (!expenseDocument) {
        throw new Error(`ExpenseDocument not found: ${documentId}`);
      }

      // STEP D: Extract full document markdown AND convert to images (parallel)
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.PROCESSING);

      const [fullMarkdown, pageImages] = await Promise.all([
        this.parsingService.extractFullDocumentMarkdown(originalFilePath, 'textract'),
        this.parsingService.convertPdfToImages(originalFilePath),
      ]);

      // Parse markdown with images for vision-based analysis
      const pageMarkdowns = this.parsingService.parseMarkdownPagesWithImages(fullMarkdown, pageImages);

      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.TEXTRACT_COMPLETE, {
        totalPages: pageMarkdowns.length,
        processingMetadata: {
          ...expenseDocument.processingMetadata,
          textractCompleted: new Date().toISOString(),
          totalPages: pageMarkdowns.length,
          hasVisionData: pageImages.length > 0,
        },
      });

      // STEP E: LLM boundary detection (with vision when images available)
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.BOUNDARY_DETECTION);
      const pageAnalysis = await this.documentSplitterAgent.analyzePages(pageMarkdowns);
      this.splittingService.validatePageAnalysis(pageAnalysis, pageMarkdowns.length);

      // STEP F: PDF splitting
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.SPLITTING);
      const splitPdfs = await this.splittingService.createSplitPdfFiles(originalFilePath, pageAnalysis, tempDirectory);
      const invoiceGroups = this.combineResultsWithPdfPaths(pageMarkdowns, pageAnalysis, splitPdfs);

      // STEP G: Upload splits and persist receipts (filters out Expensify container pages)
      const { receipts, uploadedGroups, skippedExpensify } = await this.uploadAndPersistReceipts(expenseDocument, invoiceGroups);

      // STEP H: Update document completion
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.COMPLETED, {
        totalReceipts: receipts.length,
        processingMetadata: {
          ...expenseDocument.processingMetadata,
          completedAt: new Date().toISOString(),
          totalReceipts: receipts.length,
          successfulUploads: receipts.length,
          skippedExpensifyPages: skippedExpensify,
          totalDetectedInvoices: invoiceGroups.length,
        },
      });

      // STEP I: Enqueue receipt processing
      await this.queueService.enqueueReceiptProcessing(receipts, { userId, country, icp, documentReader });

      const processingTime = Date.now() - startTime;
      this.logger.log(`Document splitting completed: ${receipts.length} receipts created in ${processingTime}ms`, {
        documentId,
        receiptIds: receipts.map((r) => r.id),
      });

      return {
        success: true,
        data: {
          documentId,
          totalPages: pageMarkdowns.length,
          totalInvoices: pageAnalysis.totalInvoices,
          receiptIds: receipts.map((r) => r.id),
        },
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Document splitting failed for ${documentId}:`, error);

      // Mark document as failed
      try {
        const expenseDocument = await this.persistenceService.getExpenseDocumentById(documentId);
        if (expenseDocument) {
          await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.FAILED, {
            processingMetadata: {
              ...expenseDocument.processingMetadata,
              error: error.message,
              failedAt: new Date().toISOString(),
            },
          });
        }
      } catch (updateError) {
        this.logger.error(`Failed to update document status to FAILED:`, updateError);
      }

      // Cleanup temp directory on failure
      if (tempDirectory) {
        try {
          await this.storageService.cleanupTempDirectory(tempDirectory);
        } catch (cleanupError) {
          this.logger.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
        }
      }

      return {
        success: false,
        error: error.message,
        processingTime,
      };
    }
  }

  private combineResultsWithPdfPaths(
    pageMarkdowns: PageMarkdown[],
    analysis: PageAnalysisResult,
    splitPdfs: SplitPdfInfo[],
  ): InvoiceGroup[] {
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
        isExpensifyExport: group.isExpensifyExport,
        expensifyConfidence: group.expensifyConfidence,
        expensifyReason: group.expensifyReason,
        expensifyIndicators: group.expensifyIndicators,
      };
    });
  }

  private async uploadAndPersistReceipts(
    expenseDocument: any,
    invoiceGroups: InvoiceGroup[],
  ): Promise<{ receipts: any[]; uploadedGroups: InvoiceGroup[]; skippedExpensify: number }> {
    const receiptsData: ReceiptCreationData[] = [];
    const uploadedGroups: InvoiceGroup[] = [];
    let skippedExpensify = 0;

    for (const group of invoiceGroups) {
      // Skip Expensify container/summary pages - they are not actual receipts
      if (group.isExpensifyExport) {
        this.logger.log(
          `Skipping Expensify container page (invoice ${group.invoiceNumber}): ${group.expensifyReason || 'Detected as Expensify export'}`,
          { indicators: group.expensifyIndicators, confidence: group.expensifyConfidence },
        );
        skippedExpensify++;
        continue;
      }

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

    if (skippedExpensify > 0) {
      this.logger.log(`Filtered out ${skippedExpensify} Expensify container page(s) from processing`);
    }

    return { receipts, uploadedGroups, skippedExpensify };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DocumentSplittingJobData>, result: JobResult) {
    this.logger.log(
      `Job ${job?.id} for document ${job?.data?.documentId} completed: ${result.success ? 'success' : 'failure'}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DocumentSplittingJobData> | undefined, error: Error) {
    this.logger.error(`Job ${job?.id} for document ${job?.data?.documentId} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    this.logger.error(`Worker error: ${error.message}`, error.stack);
  }
}
