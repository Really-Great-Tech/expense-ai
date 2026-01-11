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
import { DocumentSplitterService } from '../services/document-splitter.service';
import { FileValidationService } from '../../utils/file-validation.service';
import { LoadTestRequestDto } from '../dto/load-test-request.dto';

@ApiTags('Load Testing')
@Controller('expenses/multi-receipt')
export class LoadTestController {
  private readonly logger = new Logger(LoadTestController.name);

  constructor(
    private readonly documentSplitterService: DocumentSplitterService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  @Post('load-test')
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
    summary: 'Load Test - Process same file multiple times',
    description: `
**Load test endpoint that processes the same uploaded file multiple times.**

This endpoint is similar to the upload endpoint but calls the service function
N times in batches to simulate load testing without needing external tools.

**Parameters:**
- count: Number of times to process the file (default: 50)
- concurrent: Batch size for parallel processing (default: 5)
- delayBetweenBatches: Delay in ms between batches (default: 2000)
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload a file for load testing',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF document to process multiple times',
        },
        userId: {
          type: 'string',
          description: 'User ID for the requests',
          example: 'load-test-user',
        },
        country: {
          type: 'string',
          description: 'Country for processing',
          example: 'Germany',
        },
        icp: {
          type: 'string',
          description: 'ICP context',
          example: 'Global People',
        },
        documentReader: {
          type: 'string',
          enum: ['textract'],
          default: 'textract',
        },
        count: {
          type: 'number',
          description: 'Number of times to process',
          default: 50,
        },
        concurrent: {
          type: 'number',
          description: 'Batch size for concurrent processing',
          default: 5,
        },
        delayBetweenBatches: {
          type: 'number',
          description: 'Delay in ms between batches to prevent overwhelming services',
          default: 2000,
        },
      },
      required: ['file', 'userId', 'country', 'icp'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Load test completed',
    schema: {
      example: {
        success: true,
        summary: {
          totalRequests: 50,
          successful: 48,
          failed: 2,
          durationSeconds: 12.5,
          requestsPerSecond: 4.0,
        },
        results: [
          { index: 1, success: true, documentId: 'uuid-1' },
          { index: 2, success: true, documentId: 'uuid-2' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or parameters',
  })
  async loadTest(@UploadedFile() file: Express.Multer.File, @Body() body: LoadTestRequestDto) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const count = body.count || 50;
    const concurrent = body.concurrent || 5;
    const delayBetweenBatches = body.delayBetweenBatches || 2000;

    this.logger.log(`Starting load test: ${count} requests, ${concurrent} concurrent, ${delayBetweenBatches}ms delay`, {
      fileName: file.originalname,
      fileSize: file.size,
      userId: body.userId,
    });

    // Validate page count once
    const pageCountResult = await this.fileValidationService.validatePageCount(file);
    if (!pageCountResult.isValid) {
      throw new HttpException(pageCountResult.error, HttpStatus.BAD_REQUEST);
    }

    const startTime = Date.now();
    const results: Array<{ index: number; success: boolean; documentId?: string; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    // Process in batches
    for (let batchStart = 0; batchStart < count; batchStart += concurrent) {
      const batchEnd = Math.min(batchStart + concurrent, count);
      const batchPromises: Promise<void>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const index = i + 1;
        const userIdWithIndex = `${body.userId}-${index}`;

        const promise = this.documentSplitterService
          .analyzeAndSplitDocumentAsync(file, {
            documentReader: body.documentReader,
            userId: userIdWithIndex,
            country: body.country,
            icp: body.icp,
          })
          .then((result) => {
            results.push({
              index,
              success: result.success,
              documentId: result.data?.expenseDocumentId,
            });
            if (result.success) {
              successful++;
            } else {
              failed++;
            }
            this.logger.log(`Request ${index}/${count}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
          })
          .catch((error) => {
            results.push({
              index,
              success: false,
              error: error.message,
            });
            failed++;
            this.logger.error(`Request ${index}/${count}: FAILED - ${error.message}`);
          });

        batchPromises.push(promise);
      }

      await Promise.all(batchPromises);
      this.logger.log(`Batch ${Math.floor(batchStart / concurrent) + 1} complete`);

      // Add delay between batches to prevent overwhelming external services
      if (batchStart + concurrent < count && delayBetweenBatches > 0) {
        this.logger.debug(`Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    const summary = {
      totalRequests: count,
      successful,
      failed,
      durationSeconds: Math.round(durationSeconds * 100) / 100,
      requestsPerSecond: Math.round((count / durationSeconds) * 100) / 100,
    };

    this.logger.log(`Load test completed`, summary);

    return {
      success: true,
      summary,
      results: results.sort((a, b) => a.index - b.index),
    };
  }
}
