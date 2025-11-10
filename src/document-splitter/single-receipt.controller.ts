import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpStatus,
  HttpException,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentSplitterService } from './document-splitter.service';
import { FileValidationService } from './services/file-validation.service';
import { SingleReceiptRequestDto } from './dto/single-receipt-request.dto';
import { SplitAnalysisResponseDto } from './dto/split-response.dto';

@ApiTags('Single-Receipt Processing')
@Controller('expenses/single-receipt')
export class SingleReceiptController {
  private readonly logger = new Logger(SingleReceiptController.name);

  constructor(
    private readonly documentSplitterService: DocumentSplitterService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Upload Single Receipt (Fast-Path)',
    description: `
**Upload a single receipt/invoice without splitting - optimized for performance.**

This endpoint is designed for single-receipt documents and provides a fast-path that:
- ✅ Skips expensive OCR and AI boundary detection
- ✅ Uploads the original file directly (no PDF splitting)
- ✅ Creates ExpenseDocument → Receipt entity flow
- ✅ Enqueues receipt for downstream processing (classification, extraction, compliance)

**Use Cases:**
- Mobile app single receipt capture
- Individual restaurant/taxi receipts
- Single-page invoices
- Any document known to contain only one receipt

**Processing Flow (Fast-Path):**
1. Upload document (PDF, up to 50MB)
2. Validate file security and integrity
3. Create ExpenseDocument entity
4. Upload original file to storage
5. Create Receipt entity (linked to ExpenseDocument)
6. Enqueue for receipt processing (OCR, classification, extraction happens downstream)

**Performance Benefits:**
- ~70-80% faster than multi-receipt endpoint
- Lower processing costs (no Textract/LLM for splitting)
- Reduced latency for single receipts

**Note:** If unsure whether document contains multiple receipts, use the multi-receipt endpoint instead.
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload a single receipt with processing parameters',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '📎 PDF or image file containing a single receipt/invoice (max 50MB)',
        },
        userId: {
          type: 'string',
          description: '👤 Unique identifier for the user submitting the expense',
          example: 'user_12345',
        },
        country: {
          type: 'string',
          description: '🌍 Country for compliance and policy validation',
          example: 'Germany',
          default: 'Germany',
        },
        icp: {
          type: 'string',
          description: '📋 Internal Control Procedure / Policy context',
          default: 'Global People',
          example: 'Global People',
        },
        documentReader: {
          type: 'string',
          description: '🔧 OCR engine for downstream receipt processing',
          enum: ['textract'],
          example: 'textract',
          default: 'textract',
        },
      },
      required: ['file', 'userId', 'country', 'icp'],
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Single receipt uploaded successfully',
    type: SplitAnalysisResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          originalFileName: 'restaurant_receipt_march_15.pdf',
          totalPages: 1,
          hasMultipleInvoices: false,
          totalInvoices: 1,
          invoices: [
            {
              invoiceNumber: 1,
              pages: [1],
              content: '',
              confidence: 1.0,
              reasoning: 'Single receipt upload (no splitting required)',
              totalPages: 1,
              pdfPath: null,
              fileName: 'restaurant_receipt_march_15.pdf',
              fileSize: 45823,
              storagePath: 'receipts/user_12345/doc_abc123/restaurant_receipt_march_15.pdf',
              receiptId: 'receipt_xyz789',
            },
          ],
          tempDirectory: '',
          expenseDocumentId: 'doc_abc123',
          receiptIds: ['receipt_xyz789'],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Invalid file or missing required parameters',
    schema: {
      example: {
        success: false,
        message: 'Invalid file type. Only PDF files are supported.',
        statusCode: 400,
        timestamp: '2025-03-15T10:30:00Z',
        path: '/expenses/single-receipt/upload',
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: '❌ File exceeds maximum allowed size',
    schema: {
      example: {
        success: false,
        message: 'File size exceeds the 50MB limit.',
        statusCode: 413,
        timestamp: '2025-03-15T10:30:00Z',
        path: '/expenses/single-receipt/upload',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '❌ Processing failed due to internal error',
    schema: {
      example: {
        success: false,
        message: 'Receipt processing failed: Storage service unavailable.',
        statusCode: 500,
        timestamp: '2025-03-15T10:30:00Z',
        path: '/expenses/single-receipt/upload',
      },
    },
  })
  async uploadSingleReceipt(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SingleReceiptRequestDto,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Step 1: File validation
      this.logger.log(`Starting file validation for single receipt: ${file.originalname}`);
      const validationResult = await this.fileValidationService.validateFile(file);

      // Step 2: Handle validation failures
      if (!validationResult.isValid) {
        this.logger.warn(`File validation failed for ${file.originalname}:`, {
          errors: validationResult.errors,
          securityFlags: validationResult.securityFlags,
        });

        // Check for critical security issues
        const criticalFlags = validationResult.securityFlags?.filter(
          (flag) => flag.severity === 'CRITICAL' || flag.severity === 'HIGH',
        );

        if (criticalFlags && criticalFlags.length > 0) {
          throw new HttpException(
            `File rejected due to security concerns: ${criticalFlags.map((f) => f.description).join(', ')}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        // Handle other validation errors
        throw new HttpException(
          `File validation failed: ${validationResult.errors.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Step 3: Log validation success with any warnings
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        this.logger.warn(`File validation warnings for ${file.originalname}:`, {
          warnings: validationResult.warnings,
        });
      }

      if (validationResult.securityFlags && validationResult.securityFlags.length > 0) {
        const lowSeverityFlags = validationResult.securityFlags.filter(
          (flag) => flag.severity === 'LOW' || flag.severity === 'MEDIUM',
        );
        if (lowSeverityFlags.length > 0) {
          this.logger.warn(`Security flags detected (non-blocking) for ${file.originalname}:`, {
            flags: lowSeverityFlags,
          });
        }
      }

      this.logger.log(`File validation passed for: ${file.originalname}`);

      // Step 4: Process as single receipt (fast-path)
      const result = await this.documentSplitterService.processSingleReceipt(file, {
        documentReader: body.documentReader,
        userId: body.userId,
        country: body.country,
        icp: body.icp,
      });

      // Step 5: Enhance response with validation metadata
      return {
        ...result,
        validation: {
          isValid: validationResult.isValid,
          fileType: validationResult.fileInfo.detectedType,
          actualMimeType: validationResult.fileInfo.mimeType,
          fileSize: validationResult.fileInfo.size,
          pageCount: validationResult.fileInfo.pageCount,
          processingHints: validationResult.processingHints,
          warnings: validationResult.warnings,
          securityStatus: validationResult.securityFlags
            ? validationResult.securityFlags.length > 0
              ? 'FLAGGED'
              : 'CLEAN'
            : 'CLEAN',
        },
      };
    } catch (error) {
      // Enhanced error logging
      this.logger.error(`Single receipt processing failed for ${file.originalname}:`, {
        error: error.message,
        userId: body.userId,
        country: body.country,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      throw new HttpException(
        `Receipt processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
