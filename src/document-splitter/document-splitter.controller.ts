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
import { SplitRequestDto } from './dto/split-request.dto';
import { SplitAnalysisResponseDto } from './dto/split-response.dto';

@ApiTags('Multi-Receipt Document Processing')
@Controller('expenses/multi-receipt')
export class DocumentSplitterController {
  private readonly logger = new Logger(DocumentSplitterController.name);

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
      // Remove fileFilter - we'll handle validation in the controller method
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Upload Multi-Receipt Document & Split into Individual Receipts',
    description: `
**Process a document containing multiple expense receipts/invoices and automatically split them into individual files.**

This endpoint intelligently analyzes PDF documents to:
- 🔍 Detect multiple receipts/invoices within a single document
- 📄 Split them into separate PDF files for each expense
- 🤖 Use AI to identify receipt boundaries and extract key information
- ✅ Validate file security and integrity before processing

**Use Cases:**
- Employee submits a scanned document with 5 restaurant receipts
- Batch processing of multiple invoice pages from email attachments
- Mobile app uploads of multi-page receipt documents

**Processing Flow:**
1. Upload document (PDF, up to 50MB)
2. AI analyzes and detects individual receipts/invoices
3. Creates separate PDF files for each expense
4. Returns metadata with file paths and extracted information
5. Each split file can be processed individually downstream

**Note:** The splitter uses AWS Textract for OCR and page detection.
The documentReader parameter specifies the reader for downstream processing of split files.
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload a multi-expense document with processing parameters',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '📎 PDF document containing multiple receipts/invoices (max 50MB)',
        },
        userId: {
          type: 'string',
          description: '👤 Unique identifier for the user submitting expenses',
          example: 'user_12345',
        },
        country: {
          type: 'string',
          description: '🌍 Country for compliance and policy validation (e.g., tax rules, receipt requirements)',
          example: 'Germany',
          default: 'Germany',
        },
        icp: {
          type: 'string',
          description: '📋 Internal Control Procedure / Policy context (e.g., department, cost center)',
          default: 'Global People',
          example: 'Global People',
        },
        documentReader: {
          type: 'string',
          description: '🔧 OCR engine for downstream processing of split receipts (Textract is used internally for splitting)',
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
    description: '✅ Multi-expense document successfully split into individual receipts',
    type: SplitAnalysisResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          originalFileName: 'employee_receipts_march_2025.pdf',
          totalPages: 7,
          hasMultipleInvoices: true,
          totalInvoices: 3,
          invoices: [
            {
              invoiceNumber: 1,
              pages: [1, 2],
              content: '# Page 1\n\nRESTAURANT RECEIPT\nDate: 2025-03-15\nTotal: €45.50...',
              confidence: 0.95,
              reasoning: 'Pages 1-2: Restaurant receipt from Italian Bistro dated March 15, 2025',
              totalPages: 2,
              pdfPath: '/temp/invoice-splits/1640995200000/expense_1_restaurant.pdf',
              fileName: 'expense_1_restaurant.pdf',
              fileSize: 45823,
            },
            {
              invoiceNumber: 2,
              pages: [3, 4],
              content: '# Page 3\n\nHOTEL INVOICE\nDate: 2025-03-17\nTotal: €320.00...',
              confidence: 0.92,
              reasoning: 'Pages 3-4: Hotel invoice from Grand Hotel dated March 17, 2025',
              totalPages: 2,
              pdfPath: '/temp/invoice-splits/1640995200000/expense_2_hotel.pdf',
              fileName: 'expense_2_hotel.pdf',
              fileSize: 52341,
            },
            {
              invoiceNumber: 3,
              pages: [5, 6, 7],
              content: '# Page 5\n\nTAXI RECEIPT\nDate: 2025-03-18\nTotal: €28.50...',
              confidence: 0.88,
              reasoning: 'Pages 5-7: Taxi receipts from various trips during March 18-20, 2025',
              totalPages: 3,
              pdfPath: '/temp/invoice-splits/1640995200000/expense_3_transport.pdf',
              fileName: 'expense_3_transport.pdf',
              fileSize: 67234,
            },
          ],
          tempDirectory: '/temp/invoice-splits/1640995200000',
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
        message: 'Invalid file type. Only PDF files are supported for expense splitting.',
        statusCode: 400,
        timestamp: '2025-03-15T10:30:00Z',
        path: '/expenses/multi-receipt/upload',
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: '❌ File exceeds maximum allowed size',
    schema: {
      example: {
        success: false,
        message: 'File size exceeds the 50MB limit. Please compress or split your document.',
        statusCode: 413,
        timestamp: '2025-03-15T10:30:00Z',
        path: '/expenses/multi-receipt/upload',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '❌ Processing failed due to internal error',
    schema: {
      example: {
        success: false,
        message: 'Document analysis failed: AI service temporarily unavailable. Please try again.',
        statusCode: 500,
        timestamp: '2025-03-15T10:30:00Z',
        path: '/expenses/multi-receipt/upload',
      },
    },
  })
  async analyzeDocument(@UploadedFile() file: Express.Multer.File, @Body() body: SplitRequestDto) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Step 1: Comprehensive file validation
      this.logger.log(`Starting file validation for: ${file.originalname}`);
      const validationResult = await this.fileValidationService.validateFile(file);

      // Step 2: Handle validation failures
      if (!validationResult.isValid) {
        this.logger.warn(`File validation failed for ${file.originalname}:`, {
          errors: validationResult.errors,
          securityFlags: validationResult.securityFlags,
        });

        // Check for critical security issues
        const criticalFlags = validationResult.securityFlags?.filter(
          flag => flag.severity === 'CRITICAL' || flag.severity === 'HIGH'
        );

        if (criticalFlags && criticalFlags.length > 0) {
          throw new HttpException(
            `File rejected due to security concerns: ${criticalFlags.map(f => f.description).join(', ')}`,
            HttpStatus.BAD_REQUEST
          );
        }

        // Handle other validation errors
        throw new HttpException(
          `File validation failed: ${validationResult.errors.join(', ')}`,
          HttpStatus.BAD_REQUEST
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
          flag => flag.severity === 'LOW' || flag.severity === 'MEDIUM'
        );
        if (lowSeverityFlags.length > 0) {
          this.logger.warn(`Security flags detected (non-blocking) for ${file.originalname}:`, {
            flags: lowSeverityFlags,
          });
        }
      }

      this.logger.log(`File validation passed for: ${file.originalname}`);

      // Step 4: Proceed with document analysis
      const result = await this.documentSplitterService.analyzeAndSplitDocument(file, {
        // Splitter forces Textract internally for page detection; this reader is for downstream processing
        documentReader: body.documentReader,
        userId: body.userId,
        country: body.country,
        icp: body.icp,
        duplicateChoice: body.duplicateChoice,
        forceResplit: body.forceResplit,
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
          // Only include non-sensitive security information in response
          securityStatus: validationResult.securityFlags ? 
            validationResult.securityFlags.length > 0 ? 'FLAGGED' : 'CLEAN' : 
            'CLEAN',
        },
      };
    } catch (error) {
      // Enhanced error logging with validation context
      this.logger.error(`Document analysis failed for ${file.originalname}:`, {
        error: error.message,
        userId: body.userId,
        country: body.country,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      throw new HttpException(`Invoice analysis failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}