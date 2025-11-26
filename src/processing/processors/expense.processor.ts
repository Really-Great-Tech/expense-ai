import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { DocumentReaderFactory } from '../../utils/documentReaderFactory';
import { DocumentProcessingData, QUEUE_NAMES, JOB_TYPES, JobResult } from '../../types';
import { ExpenseProcessingService } from '@/document/processing.service';
import { FileStorageService } from '../../storage/interfaces/file-storage.interface';
import { StorageResolverService } from '../../storage/services/storage-resolver.service';
import { ReceiptProcessingResultRepository } from '@/document/repositories/receipt-processing-result.repository';
import { ProcessingStatus } from '@/document/entities/receipt-processing-result.entity';
import { DocumentPersistenceService } from '@/document-splitter/services/document-persistence.service';
import { ReceiptStatus } from '@/document/entities/receipt.entity';
import { CountryPolicyService } from '@/country-policy/services/country-policy.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Expense Processor
 *
 * Processes expense documents through the BullMQ queue.
 * Concurrency is configured via WORKER_CONCURRENCY env var.
 * By default, processes 5 receipts concurrently.
 */
@Processor(QUEUE_NAMES.EXPENSE_PROCESSING, {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
})
export class ExpenseProcessor extends WorkerHost {
  private readonly logger = new Logger(ExpenseProcessor.name);

  constructor(
    private readonly expenseProcessingService: ExpenseProcessingService,
    @Inject('FILE_STORAGE_SERVICE')
    private readonly storageService: FileStorageService,
    private readonly storageResolver: StorageResolverService,
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

      // Get physical file path (handles both local and S3 automatically)
      const { path: filePath, isTemp } = await this.storageResolver.getPhysicalPath(storageKey);
      this.logger.log(`Resolved physical path: ${filePath} (temp: ${isTemp})`);

      try {
        // Read the document content using the specified document reader with timing
        const markdownExtractionStart = Date.now();
        const markdownContent = await this.readDocumentContent(filePath, documentReader);
        const markdownExtractionEnd = Date.now();

        const markdownExtractionTime = markdownExtractionEnd - markdownExtractionStart;
        this.logger.log(`Markdown extraction completed in ${markdownExtractionTime}ms using ${documentReader || 'default'} reader`);

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
          },
          userId, // Pass the userId from the API to Langfuse tracking
        );

        const processingTime = Date.now() - startTime;
        const totalProcessingTimeSeconds = result.timing?.total_processing_time_seconds || 'N/A';
        this.logger.log(`Receipt processing finished for job: ${jobId} in ${processingTime}ms (${totalProcessingTimeSeconds}s total)`);

        // Save complete results to database
        if (receiptId) {
          const sourceDocumentId = job.data.receiptId ? undefined : job.data.sourceDocumentId;

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
      } finally {
        // Cleanup temp file if it was downloaded from S3
        if (isTemp) {
          this.storageResolver.cleanupTempFile(filePath);
        }
      }
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

  private async readDocumentContent(filePath: string, documentReader?: string): Promise<string> {
    try {
      const fs = require('fs');
      const path = require('path');

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileExtension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      this.logger.log(`Reading document: ${fileName} (${fileExtension})`);

      // Use document reader factory to get the appropriate reader
      try {
        const readerType = documentReader || this.configService.get<string>('DOCUMENT_READER', 'textract');
        const reader = DocumentReaderFactory.getDefaultReader(this.configService, readerType);

        this.logger.log(`Extracting content from ${fileName} using ${readerType}...`);

        // Configure document reader for expense document processing
        const parseConfig = {
          // Textract specific config
          featureTypes: ['TABLES', 'FORMS'],
          outputFormat: 'markdown' as const,
        };

        const parseResult = await reader.parseDocument(filePath, parseConfig);

        if (parseResult.success && parseResult.data) {
          this.logger.log(`Successfully extracted ${parseResult.data.length} characters from ${fileName} using ${readerType}`);
          return parseResult.data;
        } else {
          const errorMsg = 'error' in parseResult ? parseResult.error : 'Unknown error';
          this.logger.error(`Document reader failed for ${fileName}: ${errorMsg}`);
          throw new Error(`Document reader failed for ${fileName}: ${errorMsg}`);
        }
      } catch (readerError) {
        this.logger.error(`Document reader error for ${fileName}: ${readerError.message}`);
        throw new Error(`Document reader error for ${fileName}: ${readerError.message}`);
      }
    } catch (error) {
      this.logger.error(`Failed to read document content: ${error.message}`);
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
      const schemaData = await this.storageService.readLocalConfigFile(schemaFile);
      
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
      await this.storageService.saveMarkdownExtraction(
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
