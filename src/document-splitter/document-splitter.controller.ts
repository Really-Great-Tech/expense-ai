import {
  Controller,
  Post,
  Delete,
  Param,
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
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiParam, ApiBody } from '@nestjs/swagger';
import { DocumentSplitterService } from './document-splitter.service';
import { FileValidationService } from './services/file-validation.service';
import { SplitRequestDto } from './dto/split-request.dto';
import { SplitAnalysisResponseDto } from './dto/split-response.dto';
import { SecurityFlag } from './types/file-validation.types';

@ApiTags('document-splitter')
@Controller('document-splitter')
export class DocumentSplitterController {
  private readonly logger = new Logger(DocumentSplitterController.name);

  constructor(
    private readonly documentSplitterService: DocumentSplitterService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  @Post('analyze')
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
    summary: 'Analyze document for multiple invoices and split into separate files',
    description: 'Analyze document for multiple invoices and split into separate files',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'PDF document upload with analysis parameters',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF document file (max 50MB)',
        },
        userId: {
          type: 'string',
          description: 'User ID initiating the split and used for storage/processing ownership',
          example: 'user_12345',
        },
        country: {
          type: 'string',
          description: 'Country code for downstream compliance processing',
          example: 'US',
        },
        icp: {
          type: 'string',
          description: 'ICP (Internal Control Procedure) or policy context for downstream processing',
          example: 'DEFAULT',
        },
        documentReader: {
          type: 'string',
          description: 'Downstream document reader for receipt processing (splitter uses Textract internally)',
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
    description: 'Document analysis completed successfully',
    type: SplitAnalysisResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          originalFileName: 'multi_invoices.pdf',
          totalPages: 5,
          hasMultipleInvoices: true,
          totalInvoices: 2,
          invoices: [
            {
              invoiceNumber: 1,
              pages: [1, 2],
              content: '# Page 1\n\nINVOICE #INV-001...\n\n---\n\n# Page 2\n\nContinued...',
              confidence: 0.95,
              reasoning: 'Pages 1-2: Invoice #INV-001 from Company A',
              totalPages: 2,
              pdfPath: '/temp/invoice-splits/1640995200000/invoice_1.pdf',
              fileName: 'invoice_1.pdf',
              fileSize: 45823,
            },
            {
              invoiceNumber: 2,
              pages: [3, 4, 5],
              content: '# Page 3\n\nINVOICE #INV-002...',
              confidence: 0.88,
              reasoning: 'Pages 3-5: Invoice #INV-002 from Company B',
              totalPages: 3,
              pdfPath: '/temp/invoice-splits/1640995200000/invoice_2.pdf',
              fileName: 'invoice_2.pdf',
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
    description: 'Invalid file or request parameters',
    schema: {
      example: {
        success: false,
        message: 'Invalid file type. Only PDF files are allowed for invoice splitting.',
        statusCode: 400,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/invoice-splitter/analyze',
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 50MB)',
    schema: {
      example: {
        success: false,
        message: 'File size exceeds the 50MB limit',
        statusCode: 413,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/invoice-splitter/analyze',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during analysis',
    schema: {
      example: {
        success: false,
        message: 'Invoice analysis failed: LLM service unavailable',
        statusCode: 500,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/invoice-splitter/analyze',
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

  @Delete('cleanup/:tempDirectory')
  @ApiOperation({
    summary: 'Clean up temporary files from invoice splitting',
  })
  @ApiParam({
    name: 'tempDirectory',
    description: 'Temporary directory name to clean up (from analyze response)',
    example: '1640995200000',
  })
  @ApiResponse({
    status: 200,
    description: 'Temporary files cleaned up successfully',
    schema: {
      example: {
        success: true,
        message: 'Temporary files cleaned up successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid directory parameter',
    schema: {
      example: {
        success: false,
        message: 'Invalid temp directory parameter',
        statusCode: 400,
      },
    },
  })
  async cleanupTempFiles(@Param('tempDirectory') tempDirectory: string) {
    if (!tempDirectory || tempDirectory.includes('..') || tempDirectory.includes('/')) {
      throw new HttpException('Invalid temp directory parameter', HttpStatus.BAD_REQUEST);
    }

    try {
      // Reconstruct full temp directory path
      const fullTempPath = `uploads/invoice-splits/${tempDirectory}`;
      await this.documentSplitterService.cleanupTempFiles(fullTempPath);

      return {
        success: true,
        message: 'Temporary files cleaned up successfully',
      };
    } catch (error) {
      throw new HttpException(`Cleanup failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
