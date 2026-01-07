import { Injectable, Logger } from '@nestjs/common';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { DocumentParsingService } from '@/services/document-parsing/document-parsing.service';
import { PdfToImageService } from '@/services/pdf-conversion/pdf-to-image.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService, ReceiptCreationData } from '@/expense-document/services/document-persistence.service';
import { DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { PageMarkdown, PageAnalysisResult, InvoiceGroup } from '@/expense-document/types/upload.types';
import { SplitExpenseJobData, SplitResult } from '../interfaces/workflow-job-data.interface';

/**
 * DocumentSplitterHandler
 *
 * Thin wrapper around existing document splitting logic.
 * Returns receipts with first-page images for FlowProducer to pass to child jobs.
 */
@Injectable()
export class DocumentSplitterHandler {
  private readonly logger = new Logger(DocumentSplitterHandler.name);

  constructor(
    private readonly documentSplitterAgent: DocumentSplitterAgent,
    private readonly parsingService: DocumentParsingService,
    private readonly pdfToImageService: PdfToImageService,
    private readonly s3Storage: S3StorageService,
    private readonly persistenceService: DocumentPersistenceService,
  ) {}

  async handle(jobData: SplitExpenseJobData): Promise<SplitResult> {
    const startTime = Date.now();
    const { documentId, storageKey, storageBucket, originalFileName, documentReader } = jobData;

    this.logger.log(`Starting document splitting: documentId=${documentId}, file=${originalFileName}`);

    // Load ExpenseDocument
    const expenseDocument = await this.persistenceService.getExpenseDocumentById(documentId);
    if (!expenseDocument) {
      throw new Error(`ExpenseDocument not found: ${documentId}`);
    }

    // Download file from S3 (supports cross-bucket downloads)
    const fileBuffer = await this.s3Storage.downloadFileFromBucket(storageBucket, storageKey);
    this.logger.log(`Downloaded file from S3: s3://${storageBucket}/${storageKey} (${fileBuffer.length} bytes)`);

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
    const invoiceGroups = this.createInvoiceGroupsFromAnalysis(pageMarkdowns, pageAnalysis, originalFileName, jobData.fileSize);

    // STEP G: Create receipts (filters out Expensify container pages)
    const storageUrl = `s3://${jobData.storageBucket}/${storageKey}`;
    const { receipts, skippedExpensify, segments } = await this.createReceiptsFromGroups(
      expenseDocument,
      invoiceGroups,
      {
        storageKey,
        storageBucket: jobData.storageBucket,
        storageType: 's3',
        storageUrl,
      },
      pageImages,
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

    const processingTime = Date.now() - startTime;
    this.logger.log(`Document splitting completed: ${receipts.length} receipts in ${processingTime}ms`, {
      documentId,
      receiptIds: receipts.map((r) => r.id),
      skippedExpensify,
    });

    // Return data for FlowProducer to create child jobs
    return {
      documentId,
      receipts: receipts.map((receipt) => {
        // Find the segment for this receipt to get its first page image
        const segment = segments.find((s) => s.receiptId === receipt.id);
        return {
          id: receipt.id,
          sourceDocumentId: receipt.sourceDocumentId,
          image: segment?.image,
        };
      }),
      segments,
      skippedExpensifyPages: skippedExpensify,
    };
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
   * Create receipts from invoice groups, filtering out Expensify container pages.
   * Also extracts first-page images for each receipt for quality assessment.
   */
  private async createReceiptsFromGroups(
    expenseDocument: any,
    invoiceGroups: InvoiceGroup[],
    storageDetails: { storageKey: string; storageBucket: string; storageType: 's3'; storageUrl: string },
    pageImages: Array<{ pageNumber: number; imageBase64: string }>,
  ): Promise<{
    receipts: any[];
    skippedExpensify: number;
    segments: Array<{
      receiptId: string;
      invoiceNumber: number;
      startPage: number;
      endPage: number;
      confidence: number;
      image?: { pageNumber: number; imageBase64: string };
    }>;
  }> {
    const receiptsData: ReceiptCreationData[] = [];
    const segmentData: Array<{
      invoiceNumber: number;
      startPage: number;
      endPage: number;
      confidence: number;
      image?: { pageNumber: number; imageBase64: string };
    }> = [];
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

      // Get first page image for this receipt's page range (for quality assessment)
      const firstPageOfReceipt = Math.min(...group.pages);
      const firstPageImage = pageImages.find((p) => p.pageNumber === firstPageOfReceipt);

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

      // Store segment data (receipt ID will be added after creation)
      segmentData.push({
        invoiceNumber: group.invoiceNumber,
        startPage: Math.min(...group.pages),
        endPage: Math.max(...group.pages),
        confidence: group.confidence,
        image: firstPageImage
          ? { pageNumber: firstPageImage.pageNumber, imageBase64: firstPageImage.imageBase64 }
          : undefined,
      });
    }

    const receipts = await this.persistenceService.createReceiptsInTransaction(receiptsData);

    // Combine receipts with segment data
    const segments = receipts.map((receipt, index) => ({
      receiptId: receipt.id,
      ...segmentData[index],
    }));

    if (skippedExpensify > 0) {
      this.logger.log(`Filtered out ${skippedExpensify} Expensify container page(s) from processing`);
    }

    return { receipts, skippedExpensify, segments };
  }
}
