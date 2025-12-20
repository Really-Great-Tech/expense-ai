import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { DocumentReaderFactory } from '../utils/documentReaderFactory';
import { DocumentProcessingData, QUEUE_NAMES, JOB_TYPES, JobResult } from '../common/types';
import { ExpenseProcessingService } from './services/expense-processing.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { ReceiptProcessingResultRepository } from '@/expense-result/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/expense-result/entities/receipt-processing-result.entity';
import { DocumentPersistenceService } from '@/expense-document/services/document-persistence.service';
import { ReceiptStatus } from '@/expense-document/entities/receipt.entity';
import { CountryPolicyService } from '@/country-policy/services/country-policy.service';
import { getAppConfig } from '../config/app.config';
import * as path from 'path';
import * as fs from 'fs';

// Get worker concurrency from centralized config (evaluated at module load time)
const workerConfig = getAppConfig();

/**
 * Expense Processor
 *
 * Processes expense documents through the BullMQ queue.
 * Concurrency is configured via WORKER_CONCURRENCY env var.
 * By default, processes 5 receipts concurrently.
 */
@Processor(QUEUE_NAMES.EXPENSE_PROCESSING, {
  concurrency: workerConfig.workers.concurrency,
})
export class ExpenseProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpenseProcessor.name);

  constructor(
    private readonly expenseProcessingService: ExpenseProcessingService,
    private readonly s3Storage: S3StorageService,
    private readonly configService: ConfigService,
    private readonly receiptProcessingResultRepo: ReceiptProcessingResultRepository,
    private readonly documentPersistenceService: DocumentPersistenceService,
    private readonly countryPolicyService: CountryPolicyService,
  ) {
    super();
  }

  async process(job: Job<DocumentProcessingData>): Promise<JobResult> {
    const startTime = Date.now();
    const { jobId, storageKey, storageType, fileName, userId, country, icp, documentReader, receiptId } = job.data;

    try {
      this.logger.log(`Starting receipt processing for job: ${jobId}, receipt: ${receiptId}, file: ${fileName}, storage: ${storageType}`);

      // Update status to PROCESSING in database
      if (receiptId) {
        await this.receiptProcessingResultRepo.updateStatus(receiptId, ProcessingStatus.PROCESSING, {
          processingStartedAt: new Date(),
        });
      }

      // Get markdown content - prefer stored extractedText, fall back to extraction
      const markdownExtractionStart = Date.now();
      let markdownContent: string;
      let markdownSource: 'stored' | 'extracted' = 'stored';

      // Try to get markdown from Receipt.extractedText (already extracted in HTTP layer)
      if (receiptId) {
        const receipt = await this.documentPersistenceService.getReceiptById(receiptId);
        if (receipt?.extractedText && receipt.extractedText.trim().length > 0) {
          markdownContent = receipt.extractedText;
          this.logger.log(`Using stored extractedText from Receipt (${markdownContent.length} chars) - no Textract call needed`);
        }
      }

      // Fallback: Extract markdown if not available (legacy receipts or single-receipt uploads)
      if (!markdownContent) {
        markdownSource = 'extracted';
        this.logger.log(`No stored extractedText found, falling back to Textract extraction`);
        const fileBuffer = await this.s3Storage.getFile(storageKey);
        markdownContent = await this.readDocumentContentFromBuffer(fileBuffer, fileName, documentReader);
      }

      const markdownExtractionEnd = Date.now();
      const markdownExtractionTime = markdownExtractionEnd - markdownExtractionStart;
      this.logger.log(`Markdown ${markdownSource === 'stored' ? 'loaded' : 'extracted'} in ${markdownExtractionTime}ms`);

      // Save markdown content locally
      await this.saveMarkdownContent(fileName, markdownContent, documentReader || 'default');

      // Load compliance data and expense schema (placeholder - should be loaded from config/database)
      const complianceData = await this.loadComplianceData(country, icp);
      const expenseSchema = await this.loadExpenseSchema();

      // Process the document through all agents (always using parallel processing)
      const result = await this.expenseProcessingService.processExpenseDocument(
        markdownContent,
        fileName,
        storageKey,
        country,
        icp,
        complianceData,
        expenseSchema,
        async (stage: string, progress: number) => {
          await job.updateProgress(progress);
          this.logger.log(`${stage}: ${progress}%`);

          // Update stage status in database
          if (receiptId) {
            const statusMap: Record<string, ProcessingStatus> = {
              parallelPhase1: ProcessingStatus.CLASSIFICATION,
              parallelPhase1Complete: ProcessingStatus.EXTRACTION,
              parallelPhase2: ProcessingStatus.VALIDATION,
              llmValidation: ProcessingStatus.QUALITY_ASSESSMENT,
              complete: ProcessingStatus.COMPLETED,
            };

            if (statusMap[stage]) {
              await this.receiptProcessingResultRepo.updateStatus(receiptId, statusMap[stage]);
            }
          }
        },
        {
          markdownExtractionTime,
          documentReader: documentReader || 'default',
          markdownSource, // Track whether we used stored or extracted markdown
        },
        userId, // Pass the userId from the API to Langfuse tracking
      );

      const processingTime = Date.now() - startTime;
      const totalProcessingTimeSeconds = result.timing?.total_processing_time_seconds || 'N/A';
      this.logger.log(`Receipt processing finished for job: ${jobId} in ${processingTime}ms (${totalProcessingTimeSeconds}s total)`);

      // Save complete results to database
      if (receiptId) {
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
            agentVersions: this.getAgentVersions(),
            modelVersions: this.getModelVersions(),
          },
          fileReferences: {
            originalReceipt: storageKey,
          },
        });

        // Update Receipt entity status
        await this.documentPersistenceService.updateReceiptStatus(receiptId, ReceiptStatus.COMPLETED, {
          parsedData: result.extraction,
        } as any);

        this.logger.log(`Saved processing results to database for receipt ${receiptId}`);
      }

      return {
        success: true,
        data: result,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Receipt processing failed for job: ${jobId}:`, error);

      // Mark as failed in database
      if (receiptId) {
        await this.receiptProcessingResultRepo.markFailed(receiptId, error);
        await this.documentPersistenceService.updateReceiptStatus(receiptId, ReceiptStatus.FAILED, {} as any);
      }

      return {
        success: false,
        error: error.message,
        processingTime,
      };
    }
  }

  private getAgentVersions(): Record<string, string> {
    return {
      imageQualityAssessment: '1.0.0',
      fileClassification: '1.0.0',
      dataExtraction: '1.0.0',
      issueDetection: '1.0.0',
      citationGenerator: '1.0.0',
    };
  }

  private getModelVersions(): Record<string, string> {
    return {
      classification: this.configService.get('CLASSIFICATION_MODEL') || 'gpt-4',
      extraction: this.configService.get('EXTRACTION_MODEL') || 'gpt-4',
      validation: this.configService.get('VALIDATION_MODEL') || 'gpt-4',
    };
  }

  /**
   * Read document content from a buffer (fallback when extractedText not available)
   * Used for legacy receipts or single-receipt uploads that don't have stored markdown
   */
  private async readDocumentContentFromBuffer(buffer: Buffer, fileName: string, documentReader?: string): Promise<string> {
    try {
      const fileExtension = path.extname(fileName).toLowerCase();

      this.logger.log(`Reading document from buffer: ${fileName} (${fileExtension}, ${buffer.length} bytes)`);

      const readerType = documentReader || this.configService.get<string>('DOCUMENT_READER', 'textract');
      const reader = DocumentReaderFactory.getDefaultReader(this.configService, readerType);

      this.logger.log(`Extracting content from ${fileName} using ${readerType}...`);

      // Configure document reader for expense document processing
      const parseConfig = {
        featureTypes: ['TABLES', 'FORMS'],
        outputFormat: 'markdown' as const,
      };

      // Use buffer-based parsing if available, otherwise fall back to temp file
      const parseResult = await reader.parseDocumentFromBuffer(buffer, fileName, parseConfig);

      if (parseResult.success && parseResult.data) {
        this.logger.log(`Successfully extracted ${parseResult.data.length} characters from ${fileName} using ${readerType}`);
        return parseResult.data;
      } else {
        const errorMsg = 'error' in parseResult ? parseResult.error : 'Unknown error';
        this.logger.error(`Document reader failed for ${fileName}: ${errorMsg}`);
        throw new Error(`Document reader failed for ${fileName}: ${errorMsg}`);
      }
    } catch (error) {
      this.logger.error(`Failed to read document content from buffer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load compliance data for a country
   * Uses database as primary source, falls back to JSON files in country_seed/
   */
  private async loadComplianceData(country: string, icp: string): Promise<any> {
    try {
      // Step 1: Try to load from database
      try {
        const countryRecord = await this.countryPolicyService.findCountryByName(country);

        if (countryRecord && countryRecord.activePolicy && countryRecord.activePolicy.rules) {
          this.logger.log(` Loaded compliance data for ${country} from database (Policy ID: ${countryRecord.activePolicyId})`);
          return countryRecord.activePolicy.rules;
        } else if (countryRecord) {
          this.logger.warn(`️ Country ${country} found in database but has no active policy set`);
        }
      } catch (dbError) {
        this.logger.warn(`Database lookup failed for ${country}: ${dbError.message}`);
      }

      // Step 2: Fall back to JSON file in country_seed directory
      this.logger.log(` Attempting to load compliance data from country_seed/${country.toLowerCase()}.json`);

      const seedFilePath = path.join(process.cwd(), 'country_seed', `${country.toLowerCase()}.json`);

      if (fs.existsSync(seedFilePath)) {
        const fileContent = fs.readFileSync(seedFilePath, 'utf-8');
        const complianceData = JSON.parse(fileContent);

        if (complianceData && typeof complianceData === 'object') {
          const sections = Object.keys(complianceData).length;
          this.logger.log(` Loaded compliance data for ${country} from JSON file (${sections} sections)`);
          return complianceData;
        }
      } else {
        this.logger.warn(`️ Seed file not found: ${seedFilePath}`);
      }

      // Step 3: No data found
      this.logger.error(` No compliance data found for ${country} (tried database and country_seed/${country.toLowerCase()}.json)`);
      return {};

    } catch (error) {
      this.logger.error(`Failed to load compliance data for ${country}: ${error.message}`);
      return {};
    }
  }

  private async loadExpenseSchema(): Promise<any> {
    try {
      const schemaFile = 'expense_file_schema.json';
      const schemaData = await this.s3Storage.readLocalConfigFile(schemaFile);
      
      if (schemaData && typeof schemaData === 'object') {
        this.logger.log(`Loaded expense schema with ${Object.keys(schemaData.properties || {}).length} fields`);
        return schemaData;
      } else {
        this.logger.warn(`No expense schema found`);
        return {};
      }
    } catch (error) {
      this.logger.error(`Failed to load expense schema: ${error.message}`);
      return {};
    }
  }

  private async saveMarkdownContent(fileName: string, markdownContent: string, readerType: string): Promise<void> {
    try {
      // Generate markdown filename with reader type
      const baseFilename = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      const markdownFilename = `${baseFilename}_${readerType}.md`;

      // Add metadata header to markdown content
      const timestamp = new Date().toISOString();
      const markdownWithMetadata = `---
# Markdown Extraction Results
- **Original File**: ${fileName}
- **Document Reader**: ${readerType}
- **Extracted At**: ${timestamp}
- **Content Length**: ${markdownContent.length} characters
---

${markdownContent}`;

      // Save markdown content using storage service
      await this.s3Storage.saveMarkdownExtraction(
        `markdown_extractions/${markdownFilename}`,
        markdownWithMetadata
      );
      
      this.logger.log(`Markdown content saved: ${markdownFilename}`);
    } catch (error) {
      this.logger.error('Failed to save markdown content:', error);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DocumentProcessingData>, result: JobResult) {
    const receiptId = job?.data?.receiptId ?? 'unknown';
    this.logger.log(
      `Job ${job?.id} (${job?.name}) for receipt ${receiptId} completed with status: ${result.success ? 'success' : 'failure'}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DocumentProcessingData> | undefined, error: Error) {
    const jobId = job?.id ?? 'unknown';
    const receiptId = job?.data?.receiptId ?? 'unknown';
    this.logger.error(`Job ${jobId} for receipt ${receiptId} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    this.logger.error(`Worker error: ${error.message}`, error.stack);
  }
}
