import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PolicyExtractionAgent } from '../../agents/policy-extraction.agent';
import { PolicyPersistenceService } from './policy-persistence.service';
import { S3StorageService } from '../../storage/s3-storage.service';
import {
  PolicyUploadResponse,
  FileProcessingResult,
  StoredFileInfo,
} from '../interfaces/policy-types.interface';

/**
 * ============================================================================
 * POLICY UPLOAD ORCHESTRATOR SERVICE
 * ============================================================================
 * 
 * This service orchestrates the complete policy upload pipeline:
 * 1. Store uploaded files (S3 or local)
 * 2. Extract policy data via LLM (placeholder)
 * 3. Validate extracted data
 * 4. Save to database (placeholder)
 * 5. Return comprehensive results
 * 
 * Handles multiple files uploaded simultaneously.
 * ============================================================================
 */

@Injectable()
export class PolicyUploadOrchestrator {
  private readonly logger = new Logger(PolicyUploadOrchestrator.name);

  constructor(
    private readonly llmAgent: PolicyExtractionAgent,
    private readonly persistenceService: PolicyPersistenceService,
    private readonly storageService: S3StorageService,
  ) {}

  /**
   * Process multiple uploaded policy documents
   * 
   * @param files - Array of uploaded files (PDF, DOCX, Excel)
   * @param countryName - Country name for these policies
   * @param countryCode - Optional country code
   * @param description - Optional description
   * @returns Complete upload result with per-file status
   */
  async processMultipleFiles(
    files: Express.Multer.File[],
    countryName: string,
    countryCode?: string,
    description?: string,
  ): Promise<PolicyUploadResponse> {
    
    this.logger.log('========================================================');
    this.logger.log('🚀 POLICY UPLOAD PIPELINE STARTING');
    this.logger.log('========================================================');
    this.logger.log(`🌍 Country: ${countryName}`);
    this.logger.log(`📁 Files to process: ${files.length}`);
    this.logger.log('');

    const results: FileProcessingResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let lastSuccessfulVersionId: string | undefined;

    // Process each file sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.logger.log(`📄 Processing file ${i + 1}/${files.length}: ${file.originalname}`);
      
      try {
        // Process single file through the pipeline
        const result = await this.processSingleFile(
          file,
          countryName,
          countryCode,
          description,
        );

        results.push(result);
        
        if (result.status === 'success') {
          successCount++;
          lastSuccessfulVersionId = result.versionId;
          this.logger.log(`✅ File ${i + 1} processed successfully`);
        } else {
          failureCount++;
          this.logger.warn(`⚠️  File ${i + 1} processing failed: ${result.error}`);
        }

      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.logger.error(`❌ File ${i + 1} processing failed:`, error);
        
        results.push({
          fileName: file.originalname,
          status: 'failed',
          error: errorMessage,
        });
      }

      this.logger.log('');
    }

    this.logger.log('========================================================');
    this.logger.log('📊 PIPELINE COMPLETE');
    this.logger.log(`✅ Successful: ${successCount}`);
    this.logger.log(`❌ Failed: ${failureCount}`);
    this.logger.log('========================================================');
    this.logger.log('');

    return {
      success: successCount > 0,
      country: countryName,
      countryCode,
      versionId: lastSuccessfulVersionId,
      filesProcessed: files.length,
      results,
      timestamp: new Date(),
    };
  }

  /**
   * Process a single policy document
   * 
   * 1. LLM extracts policy from file.buffer (file content in memory)
   * 2. Validate extracted data
   * 3. Save to database
   * 4. Store file to S3 for tracking
   */
  private async processSingleFile(
    file: Express.Multer.File,
    countryName: string,
    countryCode?: string,
    description?: string,
  ): Promise<FileProcessingResult> {
    
    // STEP 1: LLM extracts policy from file content
    // The file.buffer contains the actual file content (PDF, DOCX, etc.)
    const extractedData = await this.llmAgent.extractPolicyFromDocument(
      file.buffer,        // ← File content here
      file.originalname,
      file.mimetype,
    );

    // STEP 2: Validate extracted data
    const isValid = this.llmAgent.validateExtractedData(extractedData);
    if (!isValid) {
      throw new BadRequestException('Extracted policy data validation failed');
    }
    
    const isValidForDb = this.persistenceService.validatePolicyData(extractedData);
    if (!isValidForDb) {
      throw new BadRequestException('Policy data does not meet database requirements');
    }

    // STEP 3: Store file to S3 (for datasource tracking)
    const fileInfo = await this.storeFile(file);

    // STEP 4: Save to database
    const saveResult = await this.persistenceService.savePolicyToDatabase(
      countryName,
      extractedData,
      fileInfo,
      countryCode,
    );

    return {
      fileName: file.originalname,
      status: 'success',
      policyId: saveResult.policyId,
      versionId: saveResult.versionId,
    };
  }

  /**
   * Store uploaded file to S3 or local storage
   * 
   * TODO: Implement actual file storage
   * - For production: Upload to S3
   * - For development: Save to local filesystem
   * - Store file metadata
   */
  private async storeFile(file: Express.Multer.File): Promise<StoredFileInfo> {
    // Determine file type from MIME type
    let fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' = 'pdf';
    
    if (file.mimetype.includes('pdf')) {
      fileType = 'pdf';
    } else if (file.mimetype.includes('wordprocessingml')) {
      fileType = 'docx';
    } else if (file.mimetype.includes('spreadsheetml') || file.mimetype.includes('excel')) {
      fileType = 'xlsx';
    } else if (file.mimetype.includes('csv')) {
      fileType = 'csv';
    }

    // TODO: Implement actual storage
    // For S3: await this.storageService.uploadFile(file.buffer, fileName);
    // For local: await fs.writeFile(path, file.buffer);
    
    const mockFilePath = `/mock-storage/country-policies/${Date.now()}-${file.originalname}`;

    this.logger.log(`     [PLACEHOLDER] File would be stored at: ${mockFilePath}`);

    return {
      fileName: file.originalname,
      fileType,
      filePath: mockFilePath,
      fileSize: file.size,
      uploadedAt: new Date(),
      rawContent: undefined, // Could store extracted text here
    };
  }

  /**
   * Count total rules across all policy types
   */
  private countTotalRules(data: any): number {
    return (
      (data.receiptStandards?.length || 0) +
      (data.compliancePoliciesGrossUpRelated?.length || 0) +
      (data.compliancePoliciesAdditionalInfoRelated?.length || 0)
    );
  }

  /**
   * Validate file type is supported
   */
  validateFileType(mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.ms-excel', // XLS
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'text/csv',
    ];

    return allowedTypes.includes(mimeType);
  }
}
