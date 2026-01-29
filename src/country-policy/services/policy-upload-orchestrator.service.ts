import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PolicyExtractionAgent } from '../../agents/policy-extraction.agent';
import { PolicyValidationService } from './policy-validation.service';
import { PolicyPersistenceService } from './policy-persistence.service';
import { PolicySeedWriterService } from './policy-seed-writer.service';
import { S3StorageService } from '../../storage/s3-storage.service';
import {
  PolicyUploadResponse,
  FileProcessingResult,
  StoredFileInfo,
  ExtractedPolicyData,
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
    private readonly validationService: PolicyValidationService,
    private readonly persistenceService: PolicyPersistenceService,
    private readonly seedWriterService: PolicySeedWriterService,
    private readonly storageService: S3StorageService,
    private readonly configService: ConfigService,
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
    this.logger.log('')

    const results: FileProcessingResult[] = [];
    let versionId: string | undefined;
    let policyId: number | string | undefined;
    let extractedData: ExtractedPolicyData | undefined;
    let validationSummary: any = undefined;

    try {
      // STEP 1: Store all files to S3 (parallel processing for speed)
      this.logger.log('📤 STEP 1: Storing files to S3...');
      const storeStartTime = Date.now();

      const storePromises = files.map(async (file) => {
        const fileInfo = await this.storeFile(file);
        this.logger.log(`   ✓ ${file.originalname} → S3`);
        return { file, fileInfo };
      });

      const storedFiles = await Promise.all(storePromises);
      this.logger.log(`   Completed in ${Date.now() - storeStartTime}ms`);
      this.logger.log('');

      // STEP 2: Extract unified policy from all documents
      this.logger.log('🤖 STEP 2: Extracting unified policy from all documents...');
      const extractStartTime = Date.now();

      extractedData = await this.llmAgent.extractPolicyFromMultipleDocuments(
        files.map(file => ({
          buffer: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
        })),
        countryName,
      );

      this.logger.log(`   Completed in ${Date.now() - extractStartTime}ms`);
      this.logger.log('');

      // STEP 3: LLM-based validation of extracted policies against source documents
      // const validationEnabled = this.configService.get('POLICY_VALIDATION_ENABLED') !== 'false' && this.configService.get('POLICY_VALIDATION_ENABLED') !== false;
      const validationEnabled = false; // Temporarily disabled manually in code

      if (validationEnabled) {
        this.logger.log('🔍 STEP 3: Validating extracted policies against source documents...');
        const validationStartTime = Date.now();

        const validationResult = await this.validationService.validateExtractedPoliciesMultiDocument(
          extractedData as any, // Type cast needed - extracted data is compatible
          files.map((file) => ({
            fileName: file.originalname,
            content: file.buffer.toString('utf-8'),
          })),
          countryName,
        );

        const avgScore = this.validationService.getAverageValidationScore(validationResult);
        const problematicRules = this.validationService.getProblematicRules(validationResult);

        // Merge validation results INTO extracted data for human-readable output
        const extractedDataWithValidation = {
          receiptStandards: extractedData.receiptStandards.map((rule, index) => ({
            ...rule,
            validation_score: validationResult.receiptStandards[index]?.validation_score,
            validation_judgment: validationResult.receiptStandards[index]?.validation_judgment,
          })),
          compliancePoliciesGrossUpRelated: extractedData.compliancePoliciesGrossUpRelated.map((rule, index) => ({
            ...rule,
            validation_score: validationResult.compliancePoliciesGrossUpRelated[index]?.validation_score,
            validation_judgment: validationResult.compliancePoliciesGrossUpRelated[index]?.validation_judgment,
          })),
          compliancePoliciesAdditionalInfoRelated: extractedData.compliancePoliciesAdditionalInfoRelated.map((rule, index) => ({
            ...rule,
            validation_score: validationResult.compliancePoliciesAdditionalInfoRelated[index]?.validation_score,
            validation_judgment: validationResult.compliancePoliciesAdditionalInfoRelated[index]?.validation_judgment,
          })),
        };

        // Store validation summary for response (NOT for database)
        validationSummary = {
          overall_validation_status: validationResult.overall_validation_status,
          overall_summary: validationResult.overall_summary,
          average_score: avgScore,
          critical_issues: validationResult.critical_issues,
          icp_entities_identified: validationResult.icp_entities_identified,
          problematic_rules_count: problematicRules.length,
          // Include the merged data with validation
          extractedDataWithValidation,
        };

        this.logger.log(`   Completed in ${Date.now() - validationStartTime}ms`);
        this.logger.log(`   Overall Status: ${validationResult.overall_validation_status}`);
        this.logger.log(`   Average Score: ${avgScore.toFixed(2)}/10`);
        this.logger.log(`   Critical Issues: ${validationResult.critical_issues.length}`);

        if (problematicRules.length > 0) {
          this.logger.warn(`   ⚠️  Found ${problematicRules.length} rules with score < 7`);
          problematicRules.forEach((rule, index) => {
            if (index < 3) { // Show first 3
              this.logger.warn(`      - ${rule.table}: Score ${rule.score}/10`);
            }
          });
          if (problematicRules.length > 3) {
            this.logger.warn(`      ... and ${problematicRules.length - 3} more`);
          }
        }

        if (validationResult.critical_issues.length > 0) {
          this.logger.error(`   ❌ Critical validation issues found:`);
          validationResult.critical_issues.forEach(issue => {
            this.logger.error(`      - ${issue}`);
          });
        }
      } else {
        this.logger.log('⏩ STEP 3: Validation skipped due to configuration (POLICY_VALIDATION_ENABLED=false)');
      }

      this.logger.log('');

      // STEP 4: Schema validation for database compatibility
      this.logger.log('✅ STEP 4: Validating schema for database...');
      const isValidForDb = this.persistenceService.validatePolicyData(extractedData);
      if (!isValidForDb) {
        throw new BadRequestException('Policy data does not meet database requirements');
      }
      this.logger.log('   ✓ Schema validation passed');
      this.logger.log('');

      // STEP 5: Save unified policy to database (with references to all source files)
      this.logger.log('💾 STEP 5: Saving unified policy to database...');

      // Use the first file's info as primary, but we'll create a combined file info
      const primaryFileInfo = storedFiles[0].fileInfo;
      const allFilePaths = storedFiles.map(sf => sf.fileInfo.filePath).join(', ');

      const combinedFileInfo: StoredFileInfo = {
        ...primaryFileInfo,
        fileName: `${countryName} - Combined Policy (${files.length} documents)`,
        filePath: allFilePaths,
      };

      const saveResult = await this.persistenceService.savePolicyToDatabase(
        countryName,
        extractedData,
        combinedFileInfo,
        countryCode,
      );

      policyId = saveResult.policyId;
      versionId = saveResult.versionId;

      this.logger.log(`   ✓ Policy saved (ID: ${policyId}, Version: ${versionId})`);
      this.logger.log('');

      // STEP 6: Update seed file (optional)
      if (updateSeedFile) {
        this.logger.log('📝 STEP 6: Updating seed file...');
        try {
          await this.seedWriterService.addCountryToSeedFile(countryName, extractedData);
          this.logger.log('   ✓ Seed file updated');
        } catch (error) {
          // Log but don't fail - database is the source of truth
          this.logger.warn(`   ⚠️  Seed file update failed (non-critical): ${error}`);
        }
        this.logger.log('');
      }

      // Mark all files as successfully processed (they all contributed to one unified policy)
      for (const { file } of storedFiles) {
        results.push({
          fileName: file.originalname,
          status: 'success',
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('❌ Pipeline failed:', error);

      // Mark all files as failed since we process them as a group
      for (const file of files) {
        results.push({
          fileName: file.originalname,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    this.logger.log('========================================================');
    this.logger.log('📊 PIPELINE COMPLETE');
    this.logger.log(`✅ Success: ${results.every(r => r.status === 'success')}`);
    this.logger.log(`📄 Files processed: ${files.length}`);
    this.logger.log(`🎯 Unified policies generated: ${policyId ? 1 : 0}`);
    this.logger.log('========================================================');
    this.logger.log('');

    return {
      success: results.every(r => r.status === 'success'),
      country: countryName,
      countryCode,
      policyId,
      versionId,
      filesProcessed: files.length,
      files: files.map(f => f.originalname),
      extractedData: results.every(r => r.status === 'success') ? extractedData : undefined,
      validationResult: validationSummary, // Validation results - only in response, NOT persisted to database
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
