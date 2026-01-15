import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  Body,
  HttpStatus,
  HttpException,
  BadRequestException,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PolicyUploadOrchestrator } from '../services/policy-upload-orchestrator.service';
import { UploadPolicyDto } from '../dto/upload-policy.dto';

/**
 * ============================================================================
 * COUNTRY POLICY UPLOAD CONTROLLER
 * ============================================================================
 * 
 * API endpoint for uploading country expense policy documents.
 * Supports multiple files (PDF, DOCX, Excel) per upload.
 * 
 * Pipeline:
 * 1. User uploads files + country name
 * 2. Files validated (type, size)
 * 3. Orchestrator processes files (LLM extraction + DB save)
 * 4. Returns detailed results for each file
 * ============================================================================
 */

@ApiTags('Country Policy Management')
@Controller('country-policy')
export class PolicyUploadController {
  private readonly logger = new Logger(PolicyUploadController.name);

  constructor(
    private readonly orchestrator: PolicyUploadOrchestrator,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Upload Country Policy Documents',
    description: `
**Upload and process country expense policy documents to automatically extract and store policy rules.**

This endpoint enables dynamic policy management by:
- 📤 Accepting multiple policy documents (PDF, DOCX, Excel)
- 🤖 Extracting structured policy data using AI/LLM
- 💾 Storing policies in the database with versioning
- 📋 Tracking source documents for auditability

**Workflow:**
1. User uploads 1-10 policy files for a specific country
2. Files are validated and stored (S3 or local)
3. LLM extracts policy rules from each document
4. Data is saved to database tables (countries, versions, policies, datasources)
5. Response includes per-file success/failure status

**Extracted Policy Types:**
- **Receipt Standards**: Required data fields on receipts (supplier, date, amount, etc.)
- **Gross-up Policies**: Tax treatment rules (which expenses are tax-free or need gross-up)
- **Additional Requirements**: Extra documentation needed (approvals, logs, etc.)

**Use Cases:**
- Initial policy setup for new countries
- Policy updates and versioning
- Bulk policy imports from multiple documents
- Policy standardization across regions

**Database Tables Updated:**
1. \`countries\` - Country info (name, code, active status)
2. \`versions\` - Version tracking (per country, date-based)
3. \`country_policies\` - Policy rules as JSON
4. \`datasources\` - Source document references
5. \`countries.active_policy_id\` - Link to current active policy

**Note:** This matches the exact database structure from the migration seeding process.
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload policy documents with country information',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '📎 Policy documents (PDF, DOCX, Excel) - Max 10 files, 50MB each',
        },
        countryName: {
          type: 'string',
          description: '🌍 Country name (e.g., Germany, France, China)',
          example: 'Germany',
        },
        countryCode: {
          type: 'string',
          description: '🏷️ Optional country code (ISO 3166-1 alpha-2). Auto-derived if not provided.',
          example: 'DE',
        },
        description: {
          type: 'string',
          description: '📝 Optional description of this policy upload',
          example: 'Q1 2025 policy update with new travel expense rules',
        },
      },
      required: ['files', 'countryName'],
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Policy documents processed successfully',
    schema: {
      example: {
        success: true,
        country: 'Germany',
        countryCode: 'DE',
        versionId: 'v2025.01.14',
        filesProcessed: 3,
        results: [
          {
            fileName: 'germany_policy_2025.pdf',
            status: 'success',
            policyId: 'mock-policy-1736869234567',
            datasourceId: 'mock-datasource-1736869234567',
            versionId: 'v2025.01.14',
            extractedRulesCount: {
              receiptStandards: 15,
              grossUpPolicies: 8,
              additionalInfoPolicies: 12,
            },
          },
          {
            fileName: 'travel_expense_rules.docx',
            status: 'success',
            policyId: 'mock-policy-1736869235678',
            datasourceId: 'mock-datasource-1736869235678',
            versionId: 'v2025.01.14',
            extractedRulesCount: {
              receiptStandards: 8,
              grossUpPolicies: 5,
              additionalInfoPolicies: 7,
            },
          },
          {
            fileName: 'per_diem_rates.xlsx',
            status: 'success',
            policyId: 'mock-policy-1736869236789',
            datasourceId: 'mock-datasource-1736869236789',
            versionId: 'v2025.01.14',
            extractedRulesCount: {
              receiptStandards: 3,
              grossUpPolicies: 10,
              additionalInfoPolicies: 4,
            },
          },
        ],
        timestamp: '2025-01-14T15:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Invalid request (missing files, invalid country, bad file type)',
    schema: {
      example: {
        success: false,
        message: 'Invalid file type. Only PDF, DOCX, and Excel files are supported.',
        statusCode: 400,
        timestamp: '2025-01-14T15:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: '❌ File size exceeds limit',
    schema: {
      example: {
        success: false,
        message: 'File size exceeds the 50MB limit per file.',
        statusCode: 413,
        timestamp: '2025-01-14T15:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '❌ Processing failed due to internal error',
    schema: {
      example: {
        success: false,
        message: 'Policy extraction failed: LLM service temporarily unavailable.',
        statusCode: 500,
        timestamp: '2025-01-14T15:30:00Z',
      },
    },
  })
  async uploadPolicyDocuments(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadPolicyDto,
  ) {
    // Validate files exist
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded. Please upload at least one policy document.');
    }

    // Validate file count
    if (files.length > 10) {
      throw new BadRequestException('Too many files. Maximum 10 files can be uploaded at once.');
    }

    this.logger.log(`Received upload request for country: ${body.countryName}`);
    this.logger.log(`Files uploaded: ${files.length}`);

    try {
      // Validate file types
      for (const file of files) {
        if (!this.orchestrator.validateFileType(file.mimetype)) {
          throw new BadRequestException(
            `Invalid file type for "${file.originalname}". Only PDF, DOCX, and Excel files are supported.`,
          );
        }
      }

      // Process files through orchestrator
      const result = await this.orchestrator.processMultipleFiles(
        files,
        body.countryName,
        body.countryCode,
        body.description,
      );

      this.logger.log(`Processing complete. Success: ${result.success}`);

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Policy upload failed for country ${body.countryName}:`, {
        error: error.message,
        files: files.map(f => f.originalname),
      });

      throw new HttpException(
        `Policy processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
