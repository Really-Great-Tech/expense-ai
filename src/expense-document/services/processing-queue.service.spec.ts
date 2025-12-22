import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ProcessingQueueService } from './processing-queue.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { ReceiptProcessingResultRepository } from '@/expense-result/repositories/receipt-processing-result.repository';
import { QUEUE_NAMES, JOB_TYPES } from '@/common/types';
import { Receipt, ReceiptStatus } from '@/expense-document/entities/receipt.entity';

describe('ProcessingQueueService', () => {
  let service: ProcessingQueueService;
  let mockExpenseQueue: jest.Mocked<any>;
  let mockPersistenceService: jest.Mocked<DocumentPersistenceService>;
  let mockReceiptProcessingResultRepo: jest.Mocked<ReceiptProcessingResultRepository>;

  beforeEach(async () => {
    mockExpenseQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id' }),
    };

    mockPersistenceService = {
      updateReceiptStatus: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockReceiptProcessingResultRepo = {
      create: jest.fn().mockResolvedValue({ id: 'result-id' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingQueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.EXPENSE_PROCESSING),
          useValue: mockExpenseQueue,
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

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('enqueueReceiptProcessing', () => {
    const createMockReceipt = (id: string, fileName: string): Receipt => ({
      id,
      fileName,
      storageKey: `storage/key/${fileName}`,
      storageType: 's3',
      storageBucket: 'test-bucket',
      sourceDocumentId: 'doc-123',
      status: ReceiptStatus.CREATED,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Receipt);

    const mockOptions = {
      userId: 'user-123',
      country: 'Germany',
      icp: 'Global People',
      documentReader: 'textract',
    };

    it('should enqueue processing for single receipt', async () => {
      const receipts = [createMockReceipt('receipt-1', 'receipt1.pdf')];

      await service.enqueueReceiptProcessing(receipts, mockOptions);

      expect(mockReceiptProcessingResultRepo.create).toHaveBeenCalledTimes(1);
      expect(mockExpenseQueue.add).toHaveBeenCalledTimes(1);
      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledTimes(1);
    });

    it('should enqueue processing for multiple receipts', async () => {
      const receipts = [
        createMockReceipt('receipt-1', 'receipt1.pdf'),
        createMockReceipt('receipt-2', 'receipt2.pdf'),
        createMockReceipt('receipt-3', 'receipt3.pdf'),
      ];

      await service.enqueueReceiptProcessing(receipts, mockOptions);

      expect(mockReceiptProcessingResultRepo.create).toHaveBeenCalledTimes(3);
      expect(mockExpenseQueue.add).toHaveBeenCalledTimes(3);
      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledTimes(3);
    });

    it('should create correct job data', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      expect(mockExpenseQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.PROCESS_DOCUMENT,
        expect.objectContaining({
          storageKey: receipt.storageKey,
          storageType: receipt.storageType,
          storageBucket: receipt.storageBucket,
          fileName: receipt.fileName,
          userId: mockOptions.userId,
          country: mockOptions.country,
          icp: mockOptions.icp,
          documentReader: mockOptions.documentReader,
          receiptId: receipt.id,
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('should create processing result record in database', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      expect(mockReceiptProcessingResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          receiptId: receipt.id,
          sourceDocumentId: receipt.sourceDocumentId,
          status: 'QUEUED',
        }),
      );
    });

    it('should update receipt status to PROCESSING', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledWith(
        receipt.id,
        ReceiptStatus.PROCESSING,
        expect.any(Object),
      );
    });

    it('should use default values for missing options', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');
      const minimalOptions = {};

      await service.enqueueReceiptProcessing([receipt], minimalOptions);

      expect(mockExpenseQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.PROCESS_DOCUMENT,
        expect.objectContaining({
          userId: 'anonymous',
          country: 'Unknown',
          icp: 'DEFAULT',
          documentReader: 'textract',
        }),
        expect.any(Object),
      );
    });

    it('should continue processing remaining receipts on individual failure', async () => {
      const receipts = [
        createMockReceipt('receipt-1', 'receipt1.pdf'),
        createMockReceipt('receipt-2', 'receipt2.pdf'),
        createMockReceipt('receipt-3', 'receipt3.pdf'),
      ];

      // Make second receipt fail
      mockExpenseQueue.add
        .mockResolvedValueOnce({ id: 'job-1' })
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce({ id: 'job-3' });

      await service.enqueueReceiptProcessing(receipts, mockOptions);

      // Should have attempted all 3
      expect(mockReceiptProcessingResultRepo.create).toHaveBeenCalledTimes(3);
      expect(mockExpenseQueue.add).toHaveBeenCalledTimes(3);
      // Only 2 status updates (first and third succeeded)
      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledTimes(2);
    });

    it('should handle database creation error', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');

      mockReceiptProcessingResultRepo.create.mockRejectedValue(new Error('DB error'));

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      // Queue should not be called if DB creation fails
      expect(mockExpenseQueue.add).not.toHaveBeenCalled();
    });

    it('should generate unique job IDs', async () => {
      const receipts = [
        createMockReceipt('receipt-1', 'receipt1.pdf'),
        createMockReceipt('receipt-2', 'receipt2.pdf'),
      ];

      await service.enqueueReceiptProcessing(receipts, mockOptions);

      const calls = mockExpenseQueue.add.mock.calls;
      const jobId1 = calls[0][2].jobId;
      const jobId2 = calls[1][2].jobId;

      expect(jobId1).not.toBe(jobId2);
      expect(jobId1).toMatch(/^job_\d+_[a-z0-9]+$/);
      expect(jobId2).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it('should include session ID based on parent timestamp', async () => {
      const receipts = [
        createMockReceipt('receipt-1', 'receipt1.pdf'),
        createMockReceipt('receipt-2', 'receipt2.pdf'),
      ];

      await service.enqueueReceiptProcessing(receipts, mockOptions);

      const calls = mockExpenseQueue.add.mock.calls;
      const sessionId1 = calls[0][1].sessionId;
      const sessionId2 = calls[1][1].sessionId;

      // Both receipts should have the same session ID
      expect(sessionId1).toBe(sessionId2);
      expect(sessionId1).toMatch(/^session_\d+$/);
    });

    it('should include jobId in updated metadata', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledWith(
        receipt.id,
        ReceiptStatus.PROCESSING,
        expect.objectContaining({
          jobId: expect.any(String),
        }),
      );
    });

    it('should handle empty receipts array', async () => {
      await service.enqueueReceiptProcessing([], mockOptions);

      expect(mockReceiptProcessingResultRepo.create).not.toHaveBeenCalled();
      expect(mockExpenseQueue.add).not.toHaveBeenCalled();
      expect(mockPersistenceService.updateReceiptStatus).not.toHaveBeenCalled();
    });

    it('should pass correct queue job options', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      expect(mockExpenseQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.PROCESS_DOCUMENT,
        expect.any(Object),
        {
          jobId: expect.any(String),
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    });

    it('should preserve existing metadata when updating status', async () => {
      const receipt = createMockReceipt('receipt-1', 'receipt1.pdf');
      receipt.metadata = { existingKey: 'existingValue' };

      await service.enqueueReceiptProcessing([receipt], mockOptions);

      expect(mockPersistenceService.updateReceiptStatus).toHaveBeenCalledWith(
        receipt.id,
        ReceiptStatus.PROCESSING,
        expect.objectContaining({
          existingKey: 'existingValue',
          jobId: expect.any(String),
        }),
      );
    });
  });
});
