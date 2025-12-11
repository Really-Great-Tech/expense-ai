import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiExcludeController } from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { ProcessingStatusResponseDto, ErrorResponseDto } from './dto';

@ApiExcludeController()
@ApiTags('Processing Jobs')
@Controller('jobs')
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(private readonly documentService: DocumentService) {}

  @Get('status/:jobId')
  @ApiOperation({
    summary: 'Get processing status for a job',
    description:
      'Retrieve the current processing status and progress for a specific job. Returns detailed information about each processing stage including file classification, data extraction, issue detection, and citation generation progress.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Unique job identifier returned from the process endpoint',
    example: 'job_123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    type: ProcessingStatusResponseDto,
    schema: {
      example: {
        success: true,
        data: {
          jobId: 'job_123456789',
          status: 'active',
          progress: {
            fileClassification: true,
            dataExtraction: true,
            issueDetection: false,
            citationGeneration: false,
          },
          results: {
            classification: {
              /* file classification data */
            },
            extraction: {
              /* extracted expense data */
            },
          },
          createdAt: '2025-01-15T10:30:00Z',
          updatedAt: '2025-01-15T10:33:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
    type: ErrorResponseDto,
    schema: {
      example: {
        success: false,
        message: 'Job not found',
        statusCode: 404,
        timestamp: '2025-01-15T10:30:00Z',
        path: '/jobs/status/job_123456789',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async getProcessingStatus(@Param('jobId') jobId: string) {
    this.logger.log(`[getProcessingStatus] Fetching status for jobId: ${jobId}`);

    try {
      const status = await this.documentService.getProcessingStatus(jobId);

      if (!status) {
        this.logger.warn(`[getProcessingStatus] Job not found: ${jobId}`);
        throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
      }

      this.logger.log(
        `[getProcessingStatus] Successfully retrieved status for jobId: ${jobId}, ` +
          `status: ${status.status}, progress: ${JSON.stringify(status.progress)}`,
      );

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[getProcessingStatus] Failed to get job status for jobId: ${jobId}`, error.stack);
      throw new HttpException(`Failed to get job status: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('results/:jobId')
  @ApiOperation({ summary: 'Get final processing results for a completed job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to get results for' })
  @ApiResponse({
    status: 200,
    description: 'Job results retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Job not found or not completed' })
  async getProcessingResults(@Param('jobId') jobId: string) {
    this.logger.log(`[getProcessingResults] Fetching results for jobId: ${jobId}`);

    try {
      const results = await this.documentService.getProcessingResults(jobId);

      if (!results) {
        this.logger.warn(`[getProcessingResults] Job not found or not completed: ${jobId}`);
        throw new HttpException('Job not found or not completed', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`[getProcessingResults] Successfully retrieved results for jobId: ${jobId}`);

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[getProcessingResults] Failed to get job results for jobId: ${jobId}`, error.stack);
      throw new HttpException(`Failed to get job results: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiOperation({ summary: 'List processing jobs with optional filtering' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by job status',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of results',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Offset for pagination',
  })
  @ApiResponse({ status: 200, description: 'Jobs list retrieved successfully' })
  async listJobs(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    this.logger.log(
      `[listJobs] Fetching jobs with filters - status: ${status || 'all'}, ` +
        `userId: ${userId || 'all'}, limit: ${parsedLimit}, offset: ${parsedOffset}`,
    );

    try {
      const jobs = await this.documentService.listJobs({
        status,
        userId,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      this.logger.log(
        `[listJobs] Successfully retrieved ${Array.isArray(jobs) ? jobs.length : 'unknown'} jobs ` +
          `with filters - status: ${status || 'all'}, userId: ${userId || 'all'}`,
      );

      return {
        success: true,
        data: jobs,
      };
    } catch (error) {
      this.logger.error(`[listJobs] Failed to list jobs with filters - status: ${status}, userId: ${userId}`, error.stack);
      throw new HttpException(`Failed to list jobs: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':jobId')
  @ApiOperation({ summary: 'Cancel a processing job' })
  @ApiParam({ name: 'jobId', description: 'Job ID to cancel' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async cancelJob(@Param('jobId') jobId: string) {
    this.logger.log(`[cancelJob] Attempting to cancel jobId: ${jobId}`);

    try {
      const result = await this.documentService.cancelJob(jobId);

      if (!result) {
        this.logger.warn(`[cancelJob] Job not found or cannot be cancelled: ${jobId}`);
        throw new HttpException('Job not found or cannot be cancelled', HttpStatus.NOT_FOUND);
      }

      this.logger.log(`[cancelJob] Successfully cancelled jobId: ${jobId}`);

      return {
        success: true,
        message: 'Job cancelled successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`[cancelJob] Failed to cancel jobId: ${jobId}`, error.stack);
      throw new HttpException(`Failed to cancel job: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get processing metrics and queue health' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics() {
    this.logger.log('[getMetrics] Fetching processing metrics');

    try {
      const metrics = await this.documentService.getProcessingMetrics();

      this.logger.log(
        `[getMetrics] Successfully retrieved metrics - ` +
          `totalJobs: ${metrics?.totalJobs || 0}, completedJobs: ${metrics?.completedJobs || 0}, ` +
          `failedJobs: ${metrics?.failedJobs || 0}`,
      );

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      this.logger.error('[getMetrics] Failed to retrieve processing metrics', error.stack);
      throw new HttpException(`Failed to get metrics: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('queue/health')
  @ApiOperation({
    summary: 'Queue health check endpoint',
    description: 'Get detailed queue health status including Redis connection. For overall system health, use GET /health'
  })
  @ApiResponse({ status: 200, description: 'Queue health status' })
  async queueHealthCheck() {
    this.logger.log('[queueHealthCheck] Checking queue health status');

    try {
      const health = await this.documentService.getHealthStatus();

      this.logger.log(
        `[queueHealthCheck] Queue health check successful - ` +
          `status: ${health?.status || 'unknown'}, isHealthy: ${health?.isHealthy || false}`,
      );

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error('[queueHealthCheck] Queue health check failed', error.stack);
      throw new HttpException(`Queue health check failed: ${error.message}`, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
