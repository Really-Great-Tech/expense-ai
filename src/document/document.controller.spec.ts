import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { mockProcessingStatus } from '../../test/utils/test-helpers';

describe('DocumentController', () => {
  let controller: DocumentController;
  let documentService: DocumentService;

  const mockDocumentService = {
    getProcessingStatus: jest.fn(),
    getProcessingResults: jest.fn(),
    listJobs: jest.fn(),
    cancelJob: jest.fn(),
    getProcessingMetrics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    documentService = module.get<DocumentService>(DocumentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProcessingStatus', () => {
    const jobId = 'test-job-123';

    it('should return processing status for valid jobId', async () => {
      mockDocumentService.getProcessingStatus.mockResolvedValue(mockProcessingStatus);

      const result = await controller.getProcessingStatus(jobId);

      expect(documentService.getProcessingStatus).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({
        success: true,
        data: mockProcessingStatus,
      });
    });

    it('should throw HttpException when job is not found', async () => {
      mockDocumentService.getProcessingStatus.mockResolvedValue(null);

      await expect(controller.getProcessingStatus(jobId)).rejects.toThrow(
        new HttpException('Job not found', HttpStatus.NOT_FOUND)
      );
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Database error');
      mockDocumentService.getProcessingStatus.mockRejectedValue(serviceError);

      await expect(controller.getProcessingStatus(jobId)).rejects.toThrow(
        new HttpException('Failed to get job status: Database error', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
  });

  describe('getProcessingResults', () => {
    const jobId = 'test-job-123';

    it('should return processing results for completed job', async () => {
      const mockResults = { classification: {}, extraction: {}, compliance: {} };
      mockDocumentService.getProcessingResults.mockResolvedValue(mockResults);

      const result = await controller.getProcessingResults(jobId);

      expect(documentService.getProcessingResults).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({
        success: true,
        data: mockResults,
      });
    });

    it('should throw HttpException when job is not found or not completed', async () => {
      mockDocumentService.getProcessingResults.mockResolvedValue(null);

      await expect(controller.getProcessingResults(jobId)).rejects.toThrow(
        new HttpException('Job not found or not completed', HttpStatus.NOT_FOUND)
      );
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Processing error');
      mockDocumentService.getProcessingResults.mockRejectedValue(serviceError);

      await expect(controller.getProcessingResults(jobId)).rejects.toThrow(
        new HttpException('Failed to get job results: Processing error', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
  });

  describe('listJobs', () => {
    it('should list jobs with default parameters', async () => {
      const mockJobsList = {
        jobs: [mockProcessingStatus],
        total: 1,
      };
      mockDocumentService.listJobs.mockResolvedValue(mockJobsList);

      const result = await controller.listJobs();

      expect(documentService.listJobs).toHaveBeenCalledWith({
        status: undefined,
        userId: undefined,
        limit: 50,
        offset: 0,
      });
      expect(result).toEqual({
        success: true,
        data: mockJobsList,
      });
    });

    it('should list jobs with custom parameters', async () => {
      const mockJobsList = { jobs: [], total: 0 };
      mockDocumentService.listJobs.mockResolvedValue(mockJobsList);

      await controller.listJobs('completed', 'user-123', '10', '5');

      expect(documentService.listJobs).toHaveBeenCalledWith({
        status: 'completed',
        userId: 'user-123',
        limit: 10,
        offset: 5,
      });
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Database error');
      mockDocumentService.listJobs.mockRejectedValue(serviceError);

      await expect(controller.listJobs()).rejects.toThrow(
        new HttpException('Failed to list jobs: Database error', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
  });

  describe('cancelJob', () => {
    const jobId = 'test-job-123';

    it('should cancel job successfully', async () => {
      mockDocumentService.cancelJob.mockResolvedValue(true);

      const result = await controller.cancelJob(jobId);

      expect(documentService.cancelJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({
        success: true,
        message: 'Job cancelled successfully',
        data: true,
      });
    });

    it('should throw HttpException when job cannot be cancelled', async () => {
      mockDocumentService.cancelJob.mockResolvedValue(false);

      await expect(controller.cancelJob(jobId)).rejects.toThrow(
        new HttpException('Job not found or cannot be cancelled', HttpStatus.NOT_FOUND)
      );
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Cancellation error');
      mockDocumentService.cancelJob.mockRejectedValue(serviceError);

      await expect(controller.cancelJob(jobId)).rejects.toThrow(
        new HttpException('Failed to cancel job: Cancellation error', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
  });

  describe('getMetrics', () => {
    it('should return processing metrics', async () => {
      const mockMetrics = {
        totalJobs: 100,
        completedJobs: 80,
        failedJobs: 5,
        averageProcessingTime: 30000,
        queueHealth: {},
      };
      mockDocumentService.getProcessingMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics();

      expect(documentService.getProcessingMetrics).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: mockMetrics,
      });
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Metrics error');
      mockDocumentService.getProcessingMetrics.mockRejectedValue(serviceError);

      await expect(controller.getMetrics()).rejects.toThrow(
        new HttpException('Failed to get metrics: Metrics error', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
  });

});
