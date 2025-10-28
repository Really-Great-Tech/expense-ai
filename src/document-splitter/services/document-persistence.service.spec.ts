import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentPersistenceService } from './document-persistence.service';
import { ExpenseDocument, DocumentStatus } from '@/document/entities/expense-document.entity';
import { Receipt, ReceiptStatus } from '@/document/entities/receipt.entity';
import { Country } from '@/country-policy/entities/country.entity';

// Note: Uses mocked repositories - safe to run in CI
describe('DocumentPersistenceService', () => {
  let service: DocumentPersistenceService;
  let expenseDocumentRepository: jest.Mocked<Repository<ExpenseDocument>>;
  let receiptRepository: jest.Mocked<Repository<Receipt>>;
  let countryRepository: jest.Mocked<Repository<Country>>;

  const createMockFile = (overrides = {}): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test content'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  });

  beforeEach(async () => {
    const mockExpenseDocRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      manager: {
        transaction: jest.fn(),
        getRepository: jest.fn(),
      },
    } as any;

    const mockReceiptRepo = {
      find: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockCountryRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentPersistenceService,
        {
          provide: getRepositoryToken(ExpenseDocument),
          useValue: mockExpenseDocRepository,
        },
        {
          provide: getRepositoryToken(Receipt),
          useValue: mockReceiptRepo,
        },
        {
          provide: getRepositoryToken(Country),
          useValue: mockCountryRepo,
        },
      ],
    }).compile();

    service = module.get<DocumentPersistenceService>(DocumentPersistenceService);
    expenseDocumentRepository = module.get(getRepositoryToken(ExpenseDocument));
    receiptRepository = module.get(getRepositoryToken(Receipt));
    countryRepository = module.get(getRepositoryToken(Country));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createOrGetExpenseDocument', () => {
    const mockFile = createMockFile();
    const mockOptions = {
      userId: 'user-123',
      country: 'Germany',
      icp: 'Global People',
    };

    it('should return existing document if found', async () => {
      const existingDocument = {
        id: 'doc-123',
        status: DocumentStatus.PROCESSING,
        idempotencyKey: 'some-key',
      } as ExpenseDocument;

      expenseDocumentRepository.findOne.mockResolvedValue(existingDocument);

      const result = await service.createOrGetExpenseDocument(mockFile, mockOptions);

      expect(result).toBe(existingDocument);
      expect(expenseDocumentRepository.findOne).toHaveBeenCalled();
      expect(expenseDocumentRepository.create).not.toHaveBeenCalled();
    });

    it('should create new document if not found', async () => {
      const mockCountry = { id: 1, name: 'Germany' } as Country;
      const newDocument = {
        id: 'doc-new',
        status: DocumentStatus.UPLOADED,
      } as ExpenseDocument;

      expenseDocumentRepository.findOne.mockResolvedValue(null);
      countryRepository.findOne.mockResolvedValue(mockCountry);
      expenseDocumentRepository.create.mockReturnValue(newDocument);
      expenseDocumentRepository.save.mockResolvedValue(newDocument);

      const result = await service.createOrGetExpenseDocument(mockFile, mockOptions);

      expect(result).toBe(newDocument);
      expect(countryRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Germany' },
      });
      expect(expenseDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalFileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          status: DocumentStatus.UPLOADED,
          uploadedBy: 'user-123',
          country: 'Germany',
          icp: 'Global People',
          countryId: 1,
        }),
      );
    });

    it('should handle missing country', async () => {
      const newDocument = { id: 'doc-new' } as ExpenseDocument;

      expenseDocumentRepository.findOne.mockResolvedValue(null);
      countryRepository.findOne.mockResolvedValue(null);
      expenseDocumentRepository.create.mockReturnValue(newDocument);
      expenseDocumentRepository.save.mockResolvedValue(newDocument);

      await service.createOrGetExpenseDocument(mockFile, mockOptions);

      expect(expenseDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          countryId: null,
        }),
      );
    });

    it('should use defaults for missing options', async () => {
      const newDocument = { id: 'doc-new' } as ExpenseDocument;

      expenseDocumentRepository.findOne.mockResolvedValue(null);
      expenseDocumentRepository.create.mockReturnValue(newDocument);
      expenseDocumentRepository.save.mockResolvedValue(newDocument);

      await service.createOrGetExpenseDocument(mockFile, {});

      expect(expenseDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadedBy: 'anonymous',
          country: 'Unknown',
          icp: 'DEFAULT',
        }),
      );
    });

    it('should compute consistent idempotency keys', async () => {
      expenseDocumentRepository.findOne.mockResolvedValue(null);
      expenseDocumentRepository.create.mockReturnValue({} as ExpenseDocument);
      expenseDocumentRepository.save.mockResolvedValue({} as ExpenseDocument);

      await service.createOrGetExpenseDocument(mockFile, mockOptions);
      await service.createOrGetExpenseDocument(mockFile, mockOptions);

      expect(expenseDocumentRepository.findOne).toHaveBeenCalledTimes(2);
      const firstCall = expenseDocumentRepository.findOne.mock.calls[0][0];
      const secondCall = expenseDocumentRepository.findOne.mock.calls[1][0];
      expect(firstCall).toEqual(secondCall);
    });

    it('should include processing metadata', async () => {
      const newDocument = { id: 'doc-new' } as ExpenseDocument;

      expenseDocumentRepository.findOne.mockResolvedValue(null);
      expenseDocumentRepository.create.mockReturnValue(newDocument);
      expenseDocumentRepository.save.mockResolvedValue(newDocument);

      await service.createOrGetExpenseDocument(mockFile, mockOptions);

      expect(expenseDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          processingMetadata: expect.objectContaining({
            uploadedAt: expect.any(String),
            originalRequest: mockOptions,
          }),
        }),
      );
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status', async () => {
      const document = {
        id: 'doc-123',
        status: DocumentStatus.UPLOADED,
      } as ExpenseDocument;

      await service.updateDocumentStatus(document, DocumentStatus.PROCESSING);

      expect(expenseDocumentRepository.update).toHaveBeenCalledWith(
        'doc-123',
        expect.objectContaining({
          status: DocumentStatus.PROCESSING,
          updatedAt: expect.any(Date),
        }),
      );
      expect(document.status).toBe(DocumentStatus.PROCESSING);
    });

    it('should update document with additional fields', async () => {
      const document = { id: 'doc-123' } as ExpenseDocument;
      const updates = {
        totalPages: 5,
        totalReceipts: 3,
      };

      await service.updateDocumentStatus(document, DocumentStatus.COMPLETED, updates);

      expect(expenseDocumentRepository.update).toHaveBeenCalledWith(
        'doc-123',
        expect.objectContaining({
          status: DocumentStatus.COMPLETED,
          totalPages: 5,
          totalReceipts: 3,
          updatedAt: expect.any(Date),
        }),
      );
      expect(document.totalPages).toBe(5);
      expect(document.totalReceipts).toBe(3);
    });
  });

  describe('createReceiptsInTransaction', () => {
    it('should create multiple receipts in transaction', async () => {
      const receiptsData = [
        {
          group: {
            invoiceNumber: 1,
            pages: [1, 2],
            totalPages: 2,
            content: 'Invoice content 1',
            fileName: 'invoice1.pdf',
            fileSize: 1024,
            pdfPath: '/temp/invoice1.pdf',
            confidence: 0.95,
            reasoning: 'Clear invoice structure',
          },
          storageDetails: {
            storageKey: 'receipts/inv1.pdf',
            storageBucket: 'test-bucket',
            storageType: 's3' as const,
            storageUrl: 'https://s3.amazonaws.com/test-bucket/receipts/inv1.pdf',
          },
          sourceDocumentId: 'doc-123',
        },
        {
          group: {
            invoiceNumber: 2,
            pages: [3],
            totalPages: 1,
            content: 'Invoice content 2',
            fileName: 'invoice2.pdf',
            fileSize: 512,
            pdfPath: '/temp/invoice2.pdf',
            confidence: 0.90,
            reasoning: 'Standard invoice',
          },
          storageDetails: {
            storageKey: 'receipts/inv2.pdf',
            storageBucket: 'test-bucket',
            storageType: 's3' as const,
            storageUrl: 'https://s3.amazonaws.com/test-bucket/receipts/inv2.pdf',
          },
          sourceDocumentId: 'doc-123',
        },
      ];

      const mockReceipts = [
        { id: 'receipt-1', fileName: 'invoice1.pdf' },
        { id: 'receipt-2', fileName: 'invoice2.pdf' },
      ] as Receipt[];

      const mockReceiptRepo = {
        create: jest.fn((data) => data),
        save: jest.fn((receipt) => Promise.resolve({ ...receipt, id: `receipt-${Math.random()}` })),
      };

      (expenseDocumentRepository.manager.transaction as jest.Mock).mockImplementation(async (callback) => {
        (expenseDocumentRepository.manager.getRepository as jest.Mock).mockReturnValue(mockReceiptRepo);
        return await callback(expenseDocumentRepository.manager);
      });

      const results = await service.createReceiptsInTransaction(receiptsData);

      expect(results).toHaveLength(2);
      expect(expenseDocumentRepository.manager.transaction).toHaveBeenCalled();
      expect(mockReceiptRepo.create).toHaveBeenCalledTimes(2);
      expect(mockReceiptRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should include all receipt metadata', async () => {
      const receiptData = [{
        group: {
          invoiceNumber: 1,
          pages: [1, 2, 3],
          totalPages: 3,
          content: 'Test content',
          fileName: 'test.pdf',
          fileSize: 2048,
          pdfPath: '/temp/test.pdf',
          confidence: 0.98,
          reasoning: 'High confidence split',
        },
        storageDetails: {
          storageKey: 'key',
          storageBucket: 'bucket',
          storageType: 's3' as const,
          storageUrl: 'url',
        },
        sourceDocumentId: 'doc-123',
      }];

      const mockReceiptRepo = {
        create: jest.fn((data) => data),
        save: jest.fn((receipt) => Promise.resolve(receipt)),
      };

      (expenseDocumentRepository.manager.transaction as jest.Mock).mockImplementation(async (callback) => {
        (expenseDocumentRepository.manager.getRepository as jest.Mock).mockReturnValue(mockReceiptRepo);
        return await callback(expenseDocumentRepository.manager);
      });

      await service.createReceiptsInTransaction(receiptData);

      expect(mockReceiptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            receiptNumber: 1,
            pageNumbers: [1, 2, 3],
            totalPages: 3,
            splitConfidence: 0.98,
            splitReasoning: 'High confidence split',
          },
        }),
      );
    });

    it('should handle empty receipts array', async () => {
      (expenseDocumentRepository.manager.transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(expenseDocumentRepository.manager);
      });

      const results = await service.createReceiptsInTransaction([]);

      expect(results).toEqual([]);
    });
  });

  describe('updateReceiptStatus', () => {
    it('should update receipt status', async () => {
      await service.updateReceiptStatus('receipt-123', ReceiptStatus.PROCESSING);

      expect(receiptRepository.update).toHaveBeenCalledWith('receipt-123', {
        status: ReceiptStatus.PROCESSING,
      });
    });

    it('should update receipt with metadata', async () => {
      const metadata = {
        processedAt: new Date().toISOString(),
        confidence: 0.95,
      };

      await service.updateReceiptStatus('receipt-123', ReceiptStatus.COMPLETED, metadata);

      expect(receiptRepository.update).toHaveBeenCalledWith('receipt-123', {
        status: ReceiptStatus.COMPLETED,
        metadata,
      });
    });
  });

  describe('getReceiptsByDocumentId', () => {
    it('should return receipts for document', async () => {
      const mockReceipts = [
        { id: 'receipt-1', sourceDocumentId: 'doc-123' },
        { id: 'receipt-2', sourceDocumentId: 'doc-123' },
      ] as Receipt[];

      receiptRepository.find.mockResolvedValue(mockReceipts);

      const results = await service.getReceiptsByDocumentId('doc-123');

      expect(results).toEqual(mockReceipts);
      expect(receiptRepository.find).toHaveBeenCalledWith({
        where: { sourceDocumentId: 'doc-123' },
      });
    });

    it('should return empty array if no receipts found', async () => {
      receiptRepository.find.mockResolvedValue([]);

      const results = await service.getReceiptsByDocumentId('doc-999');

      expect(results).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database errors gracefully', async () => {
      expenseDocumentRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.createOrGetExpenseDocument(createMockFile(), { userId: 'test' }),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle large file buffers', async () => {
      const largeFile = createMockFile({
        buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB
      });

      expenseDocumentRepository.findOne.mockResolvedValue(null);
      expenseDocumentRepository.create.mockReturnValue({} as ExpenseDocument);
      expenseDocumentRepository.save.mockResolvedValue({} as ExpenseDocument);

      await expect(service.createOrGetExpenseDocument(largeFile, {})).resolves.toBeDefined();
    });

    it('should handle special characters in filenames', async () => {
      const specialFile = createMockFile({
        originalname: 'test-файл-文件.pdf',
      });

      expenseDocumentRepository.findOne.mockResolvedValue(null);
      expenseDocumentRepository.create.mockReturnValue({} as ExpenseDocument);
      expenseDocumentRepository.save.mockResolvedValue({} as ExpenseDocument);

      await service.createOrGetExpenseDocument(specialFile, {});

      expect(expenseDocumentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalFileName: 'test-файл-文件.pdf',
        }),
      );
    });

    it('should handle transaction rollback', async () => {
      (expenseDocumentRepository.manager.transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      await expect(service.createReceiptsInTransaction([])).rejects.toThrow('Transaction failed');
    });
  });
});
