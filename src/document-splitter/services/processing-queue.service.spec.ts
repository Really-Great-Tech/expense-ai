import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ProcessingQueueService } from './processing-queue.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { ReceiptProcessingResultRepository } from '@/document/repositories/receipt-processing-result.repository';
import { Receipt, ReceiptStatus } from '@/document/entities/receipt.entity';
import { QUEUE_NAMES, JOB_TYPES } from '@/types';

describe('ProcessingQueueService', () => {
  let service: ProcessingQueueService;
  let mockQueue: any;
  let mockPersistenceService: jest.Mocked<DocumentPersistenceService>;

  const mockReceipt: Receipt = {
    id: 'receipt-123',
    fileName: 'invoice.pdf',
    storageKey: 'path/to/invoice.pdf',
    storageBucket: 'test-bucket',
    storageType: 's3' as const,
    storageUrl: 'https://test-bucket.s3.amazonaws.com/path/to/invoice.pdf',
    fileSize: 1024,
    status: ReceiptStatus.CREATED,
    metadata: { test: 'data' },
    parsedData: null,
    extractedText: null,
    sourceDocument: null,
    sourceDocumentId: 'doc-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    testMigrationField: null,
  } as Receipt;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id' }),
    };

    mockPersistenceService = {
      updateReceiptStatus: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockReceiptProcessingResultRepo = {
      create: jest.fn().mockResolvedValue({}),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      saveResults: jest.fn().mockResolvedValue(undefined),
      findByReceiptId: jest.fn().mockResolvedValue(null),
      findByJobId: jest.fn().mockResolvedValue(null),
      findByDocumentId: jest.fn().mockResolvedValue([]),
      markFailed: jest.fn().mockResolvedValue(undefined),
      getProcessingStats: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingQueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.EXPENSE_PROCESSING),
          useValue: mockQueue,
        },
        {
          provide: DocumentPersistenceService,
          useValue: mockPersistenceService,
        },
        {
          provide: ReceiptProcessingResultRepository,
          useValue: mockReceiptProcessingResultRepo,
        },
      ],
    }).compile();

    service = module.get<ProcessingQueueService>(ProcessingQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('enqueueReceiptProcessing', () => {
    const options = {
      userId: 'user-456',
      country: 'US',
      icp: 'ACME_CORP',
      documentReader: 'textract',
    };

    it('should enqueue single receipt for processing', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], options);

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.PROCESS_DOCUMENT,
        expect.objectContaining({
          storageKey: 'path/to/invoice.pdf',
          storageBucket: 'test-bucket',
          storageType: 's3',
          fileName: 'invoice.pdf',
          userId: 'user-456',
          country: 'US',
          icp: 'ACME_CORP',
          documentReader: 'textract',
          receiptId: 'receipt-123',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        })
      );
    });

    it('should generate unique job IDs', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], options);

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it('should update receipt status to PROCESSING', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], options);

      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledWith(
        'receipt-123',
        ReceiptStatus.PROCESSING,
        expect.objectContaining({
          test: 'data',
          jobId: expect.stringMatching(/^job_\d+_[a-z0-9]+$/),
        })
      );
    });

    it('should enqueue multiple receipts', async () => {
      const receipts = [
        mockReceipt,
        { ...mockReceipt, id: 'receipt-456', fileName: 'invoice2.pdf' },
        { ...mockReceipt, id: 'receipt-789', fileName: 'invoice3.pdf' },
      ] as Receipt[];

      await service.enqueueReceiptProcessing(receipts, options);

      expect(mockQueue.add).toHaveBeenCalledTimes(3);
      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledTimes(3);
    });

    it('should use default values when options are missing', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], {});

      expect(mockQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.PROCESS_DOCUMENT,
        expect.objectContaining({
          userId: 'anonymous',
          country: 'Unknown',
          icp: 'DEFAULT',
          documentReader: 'textract',
          actualUserId: 'anonymous',
        }),
        expect.any(Object)
      );
    });

    it('should include session ID based on timestamp', async () => {
      const beforeTimestamp = Date.now();
      await service.enqueueReceiptProcessing([mockReceipt], options);
      const afterTimestamp = Date.now();

      const jobData = mockQueue.add.mock.calls[0][1];
      const sessionId = jobData.sessionId;
      const sessionTimestamp = parseInt(sessionId.replace('session_', ''));

      expect(sessionTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(sessionTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should include upload timestamp', async () => {
      const beforeDate = new Date();
      await service.enqueueReceiptProcessing([mockReceipt], options);

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.uploadedAt).toBeInstanceOf(Date);
      expect(jobData.uploadedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    });

    it('should configure queue with retry options', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], options);

      const queueOptions = mockQueue.add.mock.calls[0][2];
      expect(queueOptions).toEqual({
        jobId: expect.any(String),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
    });

    it('should handle queue errors gracefully', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Queue error'));
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.enqueueReceiptProcessing([mockReceipt], options);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to enqueue processing'),
        expect.any(Error)
      );
    });

    it('should handle status update errors gracefully', async () => {
      mockPersistenceService.updateReceiptStatus.mockRejectedValueOnce(
        new Error('Update failed')
      );
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.enqueueReceiptProcessing([mockReceipt], options);

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should continue processing other receipts if one fails', async () => {
      const receipts = [
        mockReceipt,
        { ...mockReceipt, id: 'receipt-456' },
      ] as Receipt[];

      mockQueue.add.mockResolvedValueOnce({ id: 'job-1' });
      mockQueue.add.mockRejectedValueOnce(new Error('Queue error'));

      await service.enqueueReceiptProcessing(receipts, options);

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledTimes(1);
    });

    it('should log successful enqueue operations', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.enqueueReceiptProcessing([mockReceipt], options);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Enqueued processing job'),
        expect.objectContaining({ jobId: expect.any(String) })
      );
    });

    it('should handle empty receipt array', async () => {
      await service.enqueueReceiptProcessing([], options);

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockPersistenceService.updateReceiptStatus).not.toHaveBeenCalled();
    });

    it('should preserve existing metadata and add jobId', async () => {
      const receiptWithMetadata = {
        ...mockReceipt,
        metadata: { existingKey: 'existingValue', anotherKey: 123 },
      } as Receipt;

      await service.enqueueReceiptProcessing([receiptWithMetadata], options);

      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledWith(
        'receipt-123',
        ReceiptStatus.PROCESSING,
        expect.objectContaining({
          existingKey: 'existingValue',
          anotherKey: 123,
          jobId: expect.any(String),
        })
      );
    });

    it('should pass storage details correctly', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], options);

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.storageKey).toBe('path/to/invoice.pdf');
      expect(jobData.storageBucket).toBe('test-bucket');
      expect(jobData.storageType).toBe('s3');
    });

    it('should handle receipts with special characters in file names', async () => {
      const specialReceipt = {
        ...mockReceipt,
        fileName: 'invoice (1) - #special.pdf',
        storageKey: 'path/to/invoice%20%281%29%20-%20%23special.pdf',
      } as Receipt;

      await service.enqueueReceiptProcessing([specialReceipt], options);

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.fileName).toBe('invoice (1) - #special.pdf');
      expect(jobData.storageKey).toBe('path/to/invoice%20%281%29%20-%20%23special.pdf');
    });

    it('should use provided userId for both userId and actualUserId', async () => {
      await service.enqueueReceiptProcessing([mockReceipt], { userId: 'custom-user' });

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.userId).toBe('custom-user');
      expect(jobData.actualUserId).toBe('custom-user');
    });
  });
});
