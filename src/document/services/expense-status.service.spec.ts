import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpenseStatusService, OverallExpenseStatus } from './expense-status.service';
import { ExpenseDocument, DocumentStatus } from '../entities/expense-document.entity';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { ReceiptProcessingResult, ProcessingStatus } from '../entities/receipt-processing-result.entity';
import { NotFoundException } from '@nestjs/common';

describe('ExpenseStatusService', () => {
  let service: ExpenseStatusService;

  const mockExpenseDocumentRepo = {
    findOne: jest.fn(),
  };

  const mockReceiptRepo = {
    find: jest.fn(),
  };

  const mockReceiptProcessingResultRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseStatusService,
        {
          provide: getRepositoryToken(ExpenseDocument),
          useValue: mockExpenseDocumentRepo,
        },
        {
          provide: getRepositoryToken(Receipt),
          useValue: mockReceiptRepo,
        },
        {
          provide: getRepositoryToken(ReceiptProcessingResult),
          useValue: mockReceiptProcessingResultRepo,
        },
      ],
    }).compile();

    service = module.get<ExpenseStatusService>(ExpenseStatusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getExpenseStatus', () => {
    it('should throw NotFoundException when document not found', async () => {
      mockExpenseDocumentRepo.findOne.mockResolvedValue(null);

      await expect(service.getExpenseStatus('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should return status for completed expense with all receipts processed', async () => {
      const mockDocument = {
        id: 'doc-123',
        originalFileName: 'test.pdf',
        status: DocumentStatus.COMPLETED,
        country: 'Germany',
        icp: 'Global People',
        uploadedBy: 'user-123',
        totalPages: 1,
        totalReceipts: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ExpenseDocument;

      const mockReceipts = [
        {
          id: 'receipt-1',
          sourceDocumentId: 'doc-123',
          status: ReceiptStatus.COMPLETED,
        } as Receipt,
      ];

      const mockProcessingResults = [
        {
          id: 'result-1',
          receiptId: 'receipt-1',
          sourceDocumentId: 'doc-123',
          status: ProcessingStatus.COMPLETED,
          processingStartedAt: new Date(),
          processingCompletedAt: new Date(),
        } as ReceiptProcessingResult,
      ];

      mockExpenseDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockReceiptRepo.find.mockResolvedValue(mockReceipts);
      mockReceiptProcessingResultRepo.find.mockResolvedValue(mockProcessingResults);

      const result = await service.getExpenseStatus('doc-123');

      expect(result.expenseDocumentId).toBe('doc-123');
      expect(result.overallStatus).toBe(OverallExpenseStatus.COMPLETED);
      expect(result.receipts.total).toBe(1);
      expect(result.receipts.completed).toBe(1);
    });

    it('should return SPLITTING status when document is still processing', async () => {
      const mockDocument = {
        id: 'doc-123',
        status: DocumentStatus.PROCESSING,
        originalFileName: 'test.pdf',
        country: 'Germany',
        icp: 'Global People',
        uploadedBy: 'user-123',
        totalPages: 1,
        totalReceipts: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ExpenseDocument;

      mockExpenseDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockReceiptRepo.find.mockResolvedValue([]);
      mockReceiptProcessingResultRepo.find.mockResolvedValue([]);

      const result = await service.getExpenseStatus('doc-123');

      expect(result.overallStatus).toBe(OverallExpenseStatus.SPLITTING);
    });

    it('should return FAILED status when document splitting failed', async () => {
      const mockDocument = {
        id: 'doc-123',
        status: DocumentStatus.FAILED,
        originalFileName: 'test.pdf',
        country: 'Germany',
        icp: 'Global People',
        uploadedBy: 'user-123',
        totalPages: 0,
        totalReceipts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ExpenseDocument;

      mockExpenseDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockReceiptRepo.find.mockResolvedValue([]);
      mockReceiptProcessingResultRepo.find.mockResolvedValue([]);

      const result = await service.getExpenseStatus('doc-123');

      expect(result.overallStatus).toBe(OverallExpenseStatus.FAILED);
    });

    it('should return PROCESSING_RECEIPTS when receipts are being processed', async () => {
      const mockDocument = {
        id: 'doc-123',
        status: DocumentStatus.COMPLETED,
        originalFileName: 'test.pdf',
        country: 'Germany',
        icp: 'Global People',
        uploadedBy: 'user-123',
        totalPages: 2,
        totalReceipts: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ExpenseDocument;

      const mockReceipts = [
        { id: 'receipt-1', sourceDocumentId: 'doc-123', status: ReceiptStatus.PROCESSING } as Receipt,
        { id: 'receipt-2', sourceDocumentId: 'doc-123', status: ReceiptStatus.CREATED } as Receipt,
      ];

      const mockProcessingResults = [
        {
          id: 'result-1',
          receiptId: 'receipt-1',
          sourceDocumentId: 'doc-123',
          status: ProcessingStatus.PROCESSING,
          processingStartedAt: new Date(),
        } as ReceiptProcessingResult,
        {
          id: 'result-2',
          receiptId: 'receipt-2',
          sourceDocumentId: 'doc-123',
          status: ProcessingStatus.QUEUED,
        } as ReceiptProcessingResult,
      ];

      mockExpenseDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockReceiptRepo.find.mockResolvedValue(mockReceipts);
      mockReceiptProcessingResultRepo.find.mockResolvedValue(mockProcessingResults);

      const result = await service.getExpenseStatus('doc-123');

      expect(result.overallStatus).toBe(OverallExpenseStatus.PROCESSING_RECEIPTS);
      expect(result.receipts.processing).toBeGreaterThan(0);
    });

    it('should return PARTIALLY_COMPLETE when some receipts failed and none processing', async () => {
      const mockDocument = {
        id: 'doc-123',
        status: DocumentStatus.COMPLETED,
        originalFileName: 'test.pdf',
        country: 'Germany',
        icp: 'Global People',
        uploadedBy: 'user-123',
        totalPages: 2,
        totalReceipts: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ExpenseDocument;

      const mockReceipts = [
        { id: 'receipt-1', sourceDocumentId: 'doc-123', status: ReceiptStatus.COMPLETED } as Receipt,
        { id: 'receipt-2', sourceDocumentId: 'doc-123', status: ReceiptStatus.FAILED } as Receipt,
      ];

      const mockProcessingResults = [
        {
          id: 'result-1',
          status: ProcessingStatus.COMPLETED,
          processingCompletedAt: new Date(),
        } as ReceiptProcessingResult,
        {
          id: 'result-2',
          status: ProcessingStatus.FAILED,
          processingCompletedAt: new Date(),
        } as ReceiptProcessingResult,
      ];

      mockExpenseDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockReceiptRepo.find.mockResolvedValue(mockReceipts);
      mockReceiptProcessingResultRepo.find.mockResolvedValue(mockProcessingResults);

      const result = await service.getExpenseStatus('doc-123');

      expect(result.overallStatus).toBe(OverallExpenseStatus.PARTIALLY_COMPLETE);
      expect(result.receipts.completed).toBe(1);
      expect(result.receipts.failed).toBe(1);
    });
  });
});
