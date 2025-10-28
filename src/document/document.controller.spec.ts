import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { createMockFile, mockProcessingStatus, mockJobData } from '../../test/utils/test-helpers';

describe('DocumentController', () => {
  let controller: DocumentController;
  let documentService: DocumentService;

  const mockDocumentService = {
    queueDocumentProcessing: jest.fn(),
    getProcessingStatus: jest.fn(),
    getProcessingResults: jest.fn(),
    getComplianceResults: jest.fn(),
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

  describe('processDocument', () => {
    const mockFile = createMockFile();
    const validBody = {
      userId: 'test-user-123',
      country: 'Germany',
      icp: 'Global People',
      documentReader: 'textract',
      metadata: {
        userAgent: 'TestApp/1.0',
        ipAddress: '192.168.1.1',
        clientId: 'client-123',
      },
    };

    it('should successfully process a document', async () => {
      mockDocumentService.queueDocumentProcessing.mockResolvedValue(mockJobData);

      const result = await controller.processDocument(mockFile, validBody);

      expect(documentService.queueDocumentProcessing).toHaveBeenCalledWith({
        file: mockFile,
        userId: validBody.userId,
        country: validBody.country,
        icp: validBody.icp,
        documentReader: validBody.documentReader,
        actualUserId: validBody.userId,
        metadata: validBody.metadata,
      });

      expect(result).toEqual({
        success: true,
        message: 'Expense document processing job created successfully',
        data: mockJobData,
      });
    });

    it('should use default values when optional parameters are not provided', async () => {
      const minimalBody = { userId: 'test-user-123' };
      mockDocumentService.queueDocumentProcessing.mockResolvedValue(mockJobData);

      await controller.processDocument(mockFile, minimalBody);

      expect(documentService.queueDocumentProcessing).toHaveBeenCalledWith({
        file: mockFile,
        userId: minimalBody.userId,
        country: 'Germany',
        icp: 'Global People',
        documentReader: 'textract',
        actualUserId: minimalBody.userId,
        metadata: undefined,
      });
    });

    it('should throw HttpException when no file is uploaded', async () => {
      await expect(controller.processDocument(null, validBody)).rejects.toThrow(
        new HttpException('No file uploaded', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw HttpException when userId is missing', async () => {
      const bodyWithoutUserId = { ...validBody, userId: undefined };

      await expect(controller.processDocument(mockFile, bodyWithoutUserId as any)).rejects.toThrow(
        new HttpException('userId is required', HttpStatus.BAD_REQUEST)
      );
    });

    it('should handle service errors', async () => {
      const serviceError = new Error('Service unavailable');
      mockDocumentService.queueDocumentProcessing.mockRejectedValue(serviceError);

      await expect(controller.processDocument(mockFile, validBody)).rejects.toThrow(
        new HttpException(
          'Failed to queue expense document processing: Service unavailable',
          HttpStatus.INTERNAL_SERVER_ERROR
        )
      );
    });
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

  describe('getComplianceResults', () => {
    const jobId = 'test-job-123';

    it('should return compliance results for completed job', async () => {
      const mockComplianceResults = {
        classification: { is_expense: true },
        extraction: { amount: 100 },
        compliance: { validation_result: { is_valid: true, issues: [] } },
      };
      mockDocumentService.getComplianceResults.mockResolvedValue(mockComplianceResults);

      const result = await controller.getComplianceResults(jobId);

      expect(documentService.getComplianceResults).toHaveBeenCalledWith(jobId);
      expect(result).toEqual({
        success: true,
        data: mockComplianceResults,
      });
    });

    it('should throw HttpException when job is not found or not completed', async () => {
      mockDocumentService.getComplianceResults.mockResolvedValue(null);

      await expect(controller.getComplianceResults(jobId)).rejects.toThrow(
        new HttpException('Job not found or not completed', HttpStatus.NOT_FOUND)
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
