import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PolicyExtractionAgent } from '../../agents/policy-extraction.agent';
import { PolicyPersistenceService } from './policy-persistence.service';
import { PolicySeedWriterService } from './policy-seed-writer.service';
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
 * Orchestrates the complete policy upload pipeline:
 * 1. Store uploaded files to S3
 * 2. Extract policy data via LLM
 * 3. Validate extracted data
 * 4. Save to database
 * 5. Update seed file (optional)
 * 6. Return comprehensive results
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
    private readonly seedWriterService: PolicySeedWriterService,
    private readonly storageService: S3StorageService,
  ) { }

  /**
   * Process multiple uploaded policy documents
   * 
   * @param files - Array of uploaded files (PDF, DOCX, Excel)
   * @param countryName - Country name for these policies
   * @param countryCode - Optional country code
   * @param description - Optional description
   * @param updateSeedFile - Whether to update the seed file (default: true)
   * @returns Complete upload result with per-file status
   */
  async processMultipleFiles(
    files: Express.Multer.File[],
    countryName: string,
    countryCode?: string,
    description?: string,
    updateSeedFile: boolean = true,
  ): Promise<PolicyUploadResponse> {

    this.logger.log('========================================================');
    this.logger.log('🚀 POLICY UPLOAD PIPELINE STARTING');
    this.logger.log('========================================================');
    this.logger.log(`🌍 Country: ${countryName}`);
    this.logger.log(`📁 Files to process: ${files.length}`);
    this.logger.log(`📝 Update seed file: ${updateSeedFile}`);
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
          updateSeedFile,
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
   * 1. Store file to S3
   * 2. LLM extracts policy from file content
   * 3. Validate extracted data
   * 4. Save to database
   * 5. Update seed file (optional)
   */
  private async processSingleFile(
    file: Express.Multer.File,
    countryName: string,
    countryCode?: string,
    description?: string,
    updateSeedFile: boolean = true,
  ): Promise<FileProcessingResult> {

    // STEP 1: Store file to S3
    const fileInfo = await this.storeFile(file);

    // STEP 2: LLM extracts policy from file content
    const extractedData = await this.llmAgent.extractPolicyFromDocument(
      file.buffer,
      file.originalname,
      file.mimetype,
      countryName,
    );

    // STEP 3: Validate extracted data (already validated by Zod in agent)
    const isValidForDb = this.persistenceService.validatePolicyData(extractedData);
    if (!isValidForDb) {
      throw new BadRequestException('Policy data does not meet database requirements');
    }

    // STEP 4: Save to database
    const saveResult = await this.persistenceService.savePolicyToDatabase(
      countryName,
      extractedData,
      fileInfo,
      countryCode,
    );

    // STEP 5: Update seed file (optional)
    if (updateSeedFile) {
      try {
        await this.seedWriterService.addCountryToSeedFile(countryName, extractedData);
      } catch (error) {
        // Log but don't fail - database is the source of truth
        this.logger.warn(`Seed file update failed (non-critical): ${error}`);
      }
    }

    return {
      fileName: file.originalname,
      status: 'success',
      policyId: saveResult.policyId,
      versionId: saveResult.versionId,
      extractedData,
    };
  }

  /**
   * Store uploaded file to S3
   */
  private async storeFile(file: Express.Multer.File): Promise<StoredFileInfo> {
    // Determine file type from MIME type
    // Must match Datasource entity enum: ['url', 'file', 'csv', 'docx']
    let fileType: 'file' | 'docx' | 'csv' = 'file';

    if (file.mimetype.includes('wordprocessingml')) {
      fileType = 'docx';
    } else if (file.mimetype.includes('csv')) {
      fileType = 'csv';
    } else {
      // PDF, Excel, and images all map to 'file'
      fileType = 'file';
    }

    // Generate S3 key
    const timestamp = Date.now();
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `country-policies/${timestamp}-${safeFileName}`;

    try {
      // Upload to S3 - returns the s3Key as string
      const uploadedKey = await this.storageService.uploadFile(file.buffer, s3Key);

      this.logger.log(`   ✓ File stored to S3: ${uploadedKey}`);

      return {
        fileName: file.originalname,
        fileType,
        filePath: uploadedKey,
        fileSize: file.size,
        uploadedAt: new Date(),
        rawContent: undefined,
      };
    } catch (error) {
      // Fallback to local storage indication if S3 fails
      this.logger.warn(`   ⚠️ S3 upload failed, using local reference: ${error}`);

      return {
        fileName: file.originalname,
        fileType,
        filePath: `local://uploads/${s3Key}`,
        fileSize: file.size,
        uploadedAt: new Date(),
        rawContent: undefined,
      };
    }
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
      'image/png',
      'image/jpeg',
    ];

    return allowedTypes.includes(mimeType);
  }
}
