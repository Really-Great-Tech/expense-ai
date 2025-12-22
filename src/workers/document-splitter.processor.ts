import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentSplittingJobData, QUEUE_NAMES, JobResult } from '../common/types';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { DocumentParsingService } from '@/services/document-parsing/document-parsing.service';
import { PdfToImageService } from '@/services/pdf-conversion/pdf-to-image.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService, ReceiptCreationData } from '@/expense-document/services/document-persistence.service';
import { ProcessingQueueService } from '@/expense-document/services/processing-queue.service';
import { DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { PageMarkdown, PageAnalysisResult, InvoiceGroup } from '@/expense-document/types/upload.types';
import { getAppConfig } from '../config/app.config';

// Get worker concurrency from centralized config
const workerConfig = getAppConfig();

/**
 * Document Splitter Processor
 *
 * Handles async document splitting jobs:
 * - Textract extraction + Image conversion (parallel)
 * - LLM boundary detection with vision
 * - Expensify container page filtering
 * - Receipt creation
 * - Enqueue receipt processing
 */
@Processor(QUEUE_NAMES.DOCUMENT_SPLITTING, {
  concurrency: workerConfig.workers?.splitterConcurrency ?? 25,
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
    private readonly pdfToImageService: PdfToImageService,
    private readonly s3Storage: S3StorageService,
    private readonly persistenceService: DocumentPersistenceService,
    private readonly queueService: ProcessingQueueService,
  ) {
    super();
  }

  async process(job: Job<DocumentSplittingJobData>): Promise<JobResult> {
    const startTime = Date.now();
    const { documentId, storageKey, originalFileName, userId, country, icp, documentReader } = job.data;

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

      // Download file from S3
      const fileBuffer = await this.s3Storage.getFile(storageKey);
      this.logger.log(`Downloaded file from S3: ${fileBuffer.length} bytes`);

      // STEP D: Extract markdown AND convert to images (parallel)
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.PROCESSING);

      const [fullMarkdown, pageImages] = await Promise.all([
        this.parsingService.extractMarkdownFromBuffer(fileBuffer, originalFileName, documentReader || 'textract'),
        this.pdfToImageService.convertPdfToImages(fileBuffer).catch((err) => {
          this.logger.warn(`PDF to image conversion failed: ${err.message}, continuing without images`);
          return [];
        }),
      ]);

      // Parse markdown with images for vision-based analysis
      const pageMarkdowns =
        pageImages.length > 0
          ? this.parsingService.parseMarkdownPagesWithImages(fullMarkdown, pageImages)
          : this.parsingService.parseMarkdownPages(fullMarkdown);

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
      this.validatePageAnalysis(pageAnalysis, pageMarkdowns.length);

      // STEP F: Create invoice groups (filtering Expensify pages)
      await this.persistenceService.updateDocumentStatus(expenseDocument, DocumentStatus.SPLITTING);
      const invoiceGroups = this.createInvoiceGroupsFromAnalysis(pageMarkdowns, pageAnalysis, originalFileName, job.data.fileSize);

      // STEP G: Create receipts (filters out Expensify container pages)
      const storageUrl = `s3://${job.data.storageBucket}/${storageKey}`;
      const { receipts, uploadedGroups, skippedExpensify } = await this.createReceiptsFromGroups(
        expenseDocument,
        invoiceGroups,
        {
          storageKey,
          storageBucket: job.data.storageBucket,
          storageType: 's3',
          storageUrl,
        },
      );

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
        skippedExpensify,
      });

      return {
        success: true,
        data: {
          documentId,
          totalPages: pageMarkdowns.length,
          totalInvoices: pageAnalysis.totalInvoices,
          receiptIds: receipts.map((r) => r.id),
          skippedExpensifyPages: skippedExpensify,
        },
        processingTime,
      };
    } catch (error: any) {
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

      return {
        success: false,
        error: error.message,
        processingTime,
      };
    }
  }

  /**
   * Validate page analysis results
   */
  private validatePageAnalysis(analysis: PageAnalysisResult, totalPages: number): void {
    if (!analysis || !analysis.pageGroups || analysis.pageGroups.length === 0) {
      throw new Error('Invalid page analysis: no page groups returned');
    }

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
   * Create invoice groups from page analysis
   */
  private createInvoiceGroupsFromAnalysis(
    pageMarkdowns: PageMarkdown[],
    analysis: PageAnalysisResult,
    originalFileName: string,
    fileSize: number,
  ): InvoiceGroup[] {
    return analysis.pageGroups.map((group) => {
      const combinedMarkdown = this.parsingService.combinePageMarkdown(pageMarkdowns, group.pages);
      const estimatedFileSize = Math.round(fileSize / analysis.totalInvoices);

      return {
        invoiceNumber: group.invoiceNumber,
        pages: group.pages,
        content: combinedMarkdown,
        confidence: group.confidence,
        reasoning: group.reasoning,
        totalPages: group.pages.length,
        pdfPath: null,
        fileName: `invoice_${group.invoiceNumber}_${originalFileName}`,
        fileSize: estimatedFileSize,
        // Expensify detection fields
        isExpensifyExport: group.isExpensifyExport,
        expensifyConfidence: group.expensifyConfidence,
        expensifyReason: group.expensifyReason,
        expensifyIndicators: group.expensifyIndicators,
      };
    });
  }

  /**
   * Create receipts from invoice groups, filtering out Expensify container pages
   */
  private async createReceiptsFromGroups(
    expenseDocument: any,
    invoiceGroups: InvoiceGroup[],
    storageDetails: { storageKey: string; storageBucket: string; storageType: 's3'; storageUrl: string },
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

      // Create receipt data pointing to original document
      receiptsData.push({
        group,
        storageDetails: {
          storageKey: storageDetails.storageKey,
          storageBucket: storageDetails.storageBucket,
          storageType: storageDetails.storageType,
          storageUrl: storageDetails.storageUrl,
        },
        sourceDocumentId: expenseDocument.id,
      });

      uploadedGroups.push({
        ...group,
        storagePath: storageDetails.storageKey,
      });
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

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.error(`Job ${jobId} has stalled - worker may have crashed or job exceeded lock duration`);
  }
}
