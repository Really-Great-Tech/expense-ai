import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseStatusController } from './expense-status.controller';
import { ExpenseStatusService } from '../services/expense-status.service';
import { ReceiptResultsQueryService } from '../services/receipt-results-query.service';

describe('ExpenseStatusController', () => {
  let controller: ExpenseStatusController;
  let expenseStatusService: ExpenseStatusService;
  let receiptResultsQuery: ReceiptResultsQueryService;

  const mockExpenseStatusService = {
    getExpenseStatus: jest.fn(),
  };

  const mockReceiptResultsQueryService = {
    getDocumentResults: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseStatusController],
      providers: [
        {
          provide: ExpenseStatusService,
          useValue: mockExpenseStatusService,
        },
        {
          provide: ReceiptResultsQueryService,
          useValue: mockReceiptResultsQueryService,
        },
      ],
    }).compile();

    controller = module.get<ExpenseStatusController>(ExpenseStatusController);
    expenseStatusService = module.get<ExpenseStatusService>(ExpenseStatusService);
    receiptResultsQuery = module.get<ReceiptResultsQueryService>(ReceiptResultsQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getExpenseStatus', () => {
    it('should return expense status', async () => {
      const expenseId = 'test-expense-123';
      const mockStatus = {
        expenseDocumentId: expenseId,
        originalFileName: 'test.pdf',
        documentStatus: 'COMPLETED',
        overallStatus: 'COMPLETED',
        progress: {
          uploadProgress: 100,
          processingProgress: 100,
          overallProgress: 100,
        },
        receipts: {
          total: 2,
          created: 0,
          queued: 0,
          processing: 0,
          completed: 2,
          failed: 0,
        },
        timestamps: {
          uploadedAt: new Date(),
        },
        metadata: {
          country: 'Germany',
          icp: 'Global People',
          uploadedBy: 'user_123',
          totalPages: 2,
          totalReceipts: 2,
        },
      };

      mockExpenseStatusService.getExpenseStatus.mockResolvedValue(mockStatus);

      const result = await controller.getExpenseStatus(expenseId);

      expect(expenseStatusService.getExpenseStatus).toHaveBeenCalledWith(expenseId);
      expect(result).toEqual(mockStatus);
    });

    it('should handle errors from service', async () => {
      const expenseId = 'test-expense-123';
      const error = new Error('Service error');

      mockExpenseStatusService.getExpenseStatus.mockRejectedValue(error);

      await expect(controller.getExpenseStatus(expenseId)).rejects.toThrow(error);
      expect(expenseStatusService.getExpenseStatus).toHaveBeenCalledWith(expenseId);
    });
  });

  describe('getExpenseResults', () => {
    it('should return expense results', async () => {
      const expenseId = 'test-expense-123';
      const mockResults = {
        document: {
          id: expenseId,
          originalFileName: 'test.pdf',
          status: 'COMPLETED',
        },
        receipts: [
          {
            receiptId: 'receipt_001',
            status: 'COMPLETED',
          },
        ],
        overallProgress: 100,
        stats: {
          total: 1,
          completed: 1,
          failed: 0,
          processing: 0,
          queued: 0,
        },
      };

      mockReceiptResultsQueryService.getDocumentResults.mockResolvedValue(mockResults);

      const result = await controller.getExpenseResults(expenseId);

      expect(receiptResultsQuery.getDocumentResults).toHaveBeenCalledWith(expenseId);
      expect(result).toEqual(mockResults);
    });

    it('should handle errors from service', async () => {
      const expenseId = 'test-expense-123';
      const error = new Error('Service error');

      mockReceiptResultsQueryService.getDocumentResults.mockRejectedValue(error);

      await expect(controller.getExpenseResults(expenseId)).rejects.toThrow(error);
      expect(receiptResultsQuery.getDocumentResults).toHaveBeenCalledWith(expenseId);
    });
  });
});
