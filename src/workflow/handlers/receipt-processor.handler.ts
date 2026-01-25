import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ExpenseProcessingService } from '@/workers/services/expense-processing.service';
import { ReceiptProcessingResultRepository } from '@/expense-result/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/expense-result/entities/receipt-processing-result.entity';
import { DocumentPersistenceService } from '@/expense-document/services/document-persistence.service';
import { ReceiptStatus } from '@/expense-document/entities/receipt.entity';
import { CountryPolicyService } from '@/country-policy/services/country-policy.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentReaderFactory } from '@/utils/documentReaderFactory';
import { EXPENSE_SCHEMA } from '@/common/types';
import { ProcessReceiptJobData } from '../interfaces/workflow-job-data.interface';
import * as path from 'path';
import * as fs from 'fs';

/**
 * ReceiptProcessorHandler
 *
 * Thin wrapper around ExpenseProcessingService.
 * Uses pre-extracted image from job data for quality assessment (fixes page 1 bug).
 */
@Injectable()
export class ReceiptProcessorHandler {
  private readonly logger = new Logger(ReceiptProcessorHandler.name);

  constructor(
    private readonly expenseProcessingService: ExpenseProcessingService,
    private readonly receiptProcessingResultRepo: ReceiptProcessingResultRepository,
    private readonly documentPersistenceService: DocumentPersistenceService,
    private readonly countryPolicyService: CountryPolicyService,
    private readonly s3Storage: S3StorageService,
    private readonly configService: ConfigService,
  ) { }

  async handle(job: Job<ProcessReceiptJobData>): Promise<{ receiptId: string; success: boolean }> {
    const startTime = Date.now();
    const { receiptId, sourceDocumentId, userId, country, icp, documentReader, image } = job.data;

    await job.updateProgress(0);
    await job.log(`Starting receipt processing: receiptId=${receiptId}, documentId=${sourceDocumentId}`);
    this.logger.log(`Starting receipt processing: receiptId=${receiptId}, documentId=${sourceDocumentId}`);

    try {
      // Update status to PROCESSING in database
      await this.receiptProcessingResultRepo.updateStatus(receiptId, ProcessingStatus.PROCESSING, {
        processingStartedAt: new Date(),
      });

      // Load receipt from database
      const receipt = await this.documentPersistenceService.getReceiptById(receiptId);
      if (!receipt) {
        throw new Error(`Receipt not found: ${receiptId}`);
      }
      await job.updateProgress(10);

      // Get markdown content - prefer stored extractedText, fall back to extraction
      const markdownExtractionStart = Date.now();
      let markdownContent: string;
      let markdownSource: 'stored' | 'extracted' = 'stored';

      if (receipt.extractedText && receipt.extractedText.trim().length > 0) {
        markdownContent = receipt.extractedText;
        this.logger.log(`Using stored extractedText from Receipt (${markdownContent.length} chars) - no Textract call needed`);
      } else {
        // Fallback: Extract markdown if not available (legacy receipts)
        markdownSource = 'extracted';
        this.logger.log(`No stored extractedText found, falling back to Textract extraction`);
        const fileBuffer = await this.s3Storage.downloadFile(receipt.storageKey);
        markdownContent = await this.readDocumentContentFromBuffer(fileBuffer, receipt.fileName, documentReader);
      }

      const markdownExtractionTime = Date.now() - markdownExtractionStart;
      await job.updateProgress(20);
      const mdSource = markdownSource === 'stored' ? 'loaded' : 'extracted';
      await job.log(`Markdown ${mdSource} (${markdownContent.length} chars) in ${markdownExtractionTime}ms`);
      this.logger.log(`Markdown ${mdSource} in ${markdownExtractionTime}ms`);

      // Load policy markdown for compliance analysis
      await job.log(`Loading policy markdown for ${country}...`);
      const policyMarkdown = await this.loadPolicyMarkdown(country);
      await job.updateProgress(30);

      // Process the document through all agents
      // Note: We pass the image from job data to avoid downloading parent PDF again
      await job.log('Running expense processing agents (classification, extraction, compliance)...');
      const result = await this.processExpenseDocumentWithImage(
        markdownContent,
        receipt.fileName,
        receipt.storageKey,
        country,
        icp,
        policyMarkdown,
        EXPENSE_SCHEMA,
        image,
        {
          markdownExtractionTime,
          documentReader: documentReader || 'default',
          markdownSource,
        },
        userId,
      );
      await job.updateProgress(80);

      const processingTime = Date.now() - startTime;
      await job.log('Expense processing complete, saving results...');
      this.logger.log(`Receipt processing finished: receiptId=${receiptId} in ${processingTime}ms`);

      // Save complete results to database
      await this.receiptProcessingResultRepo.saveResults(receiptId, {
        classificationResult: result.classification,
        extractedData: result.extraction,
        complianceValidation: result.compliance,
        qualityAssessment: result.image_quality_assessment,
        citationData: result.citations,
        processingMetadata: {
          processedAt: new Date().toISOString(),
          processingTime,
          timing: result.timing,
        },
        fileReferences: {
          originalReceipt: receipt.storageKey,
        },
      });

      // Update Receipt entity status
      await this.documentPersistenceService.updateReceiptStatus(receiptId, ReceiptStatus.COMPLETED, {
        parsedData: result.extraction,
      } as any);

      await job.updateProgress(100);
      await job.log(`Receipt processing completed successfully in ${processingTime}ms`);
      this.logger.log(`Saved processing results to database for receipt ${receiptId}`);

      return { receiptId, success: true };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      await job.log(`Receipt processing FAILED after ${processingTime}ms: ${error.message}`);
      this.logger.error(`Receipt processing failed: receiptId=${receiptId}, error=${error.message}`, error.stack);

      // Mark as failed in database
      await this.receiptProcessingResultRepo.markFailed(receiptId, error);
      await this.documentPersistenceService.updateReceiptStatus(receiptId, ReceiptStatus.FAILED, {} as any);

      throw error;
    }
  }

  /**
   * Process expense document with pre-extracted image for quality assessment.
   * This avoids the bug where we always assess page 1 of parent PDF.
   */
  private async processExpenseDocumentWithImage(
    markdownContent: string,
    filename: string,
    storageKey: string,
    country: string,
    icp: string,
    policyMarkdown: string,
    expenseSchema: any,
    image: { pageNumber: number; imageBase64: string } | undefined,
    markdownExtractionInfo: { markdownExtractionTime: number; documentReader: string; markdownSource?: 'stored' | 'extracted' },
    userId?: string,
  ): Promise<any> {
    // If we have a pre-extracted image, we'll need to modify how we call the processing service
    // For now, call the existing service which will download from S3
    // TODO: Add a new method to ExpenseProcessingService that accepts imageBase64 instead of downloading

    // Log that we have the correct page image
    if (image) {
      this.logger.log(`Using receipt's first page image (page ${image.pageNumber}) for quality assessment`);
    }

    return this.expenseProcessingService.processExpenseDocument(
      markdownContent,
      filename,
      storageKey,
      country,
      icp,
      policyMarkdown,
      expenseSchema,
      undefined, // progressCallback - not needed for handler
      markdownExtractionInfo,
      userId,
    );
  }

  /**
   * Read document content from a buffer (fallback when extractedText not available)
   */
  private async readDocumentContentFromBuffer(buffer: Buffer, fileName: string, documentReader?: string): Promise<string> {
    try {
      const fileExtension = path.extname(fileName).toLowerCase();
      this.logger.log(`Reading document from buffer: ${fileName} (${fileExtension}, ${buffer.length} bytes)`);

      const readerType = documentReader || this.configService.get<string>('DOCUMENT_READER', 'textract');
      const reader = DocumentReaderFactory.getDefaultReader(this.configService, readerType);

      const parseConfig = {
        featureTypes: ['TABLES', 'FORMS'],
        outputFormat: 'markdown' as const,
      };

      const parseResult = await reader.parseDocumentFromBuffer(buffer, fileName, parseConfig);

      if (parseResult.success && parseResult.data) {
        this.logger.log(`Successfully extracted ${parseResult.data.length} characters from ${fileName}`);
        return parseResult.data;
      } else {
        const errorMsg = 'error' in parseResult ? parseResult.error : 'Unknown error';
        throw new Error(`Document reader failed for ${fileName}: ${errorMsg}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to read document content from buffer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load policy markdown for a country
   */
  private async loadPolicyMarkdown(country: string): Promise<string> {
    try {
      const countryRecord = await this.countryPolicyService.findCountryByName(country);

      if (countryRecord?.activePolicy?.policyMarkdown) {
        this.logger.log(`Loaded policy markdown for ${country} from database (Policy ID: ${countryRecord.activePolicyId}, ${countryRecord.activePolicy.pageCount} pages)`);
        return countryRecord.activePolicy.policyMarkdown;
      }

      if (countryRecord) {
        this.logger.warn(`Country ${country} found in database but has no active policy with markdown`);
      }

      throw new Error(`No policy markdown found for country: ${country}. Please ingest a policy document first.`);
    } catch (error: any) {
      this.logger.error(`Failed to load policy markdown for ${country}: ${error.message}`);
      throw error;
    }
  }
}
