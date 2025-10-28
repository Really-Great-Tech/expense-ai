import { Test, TestingModule } from '@nestjs/testing';
import { DocumentSplitterService } from './document-splitter.service';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { DocumentParsingService } from './services/document-parsing.service';
import { PdfSplittingService } from './services/pdf-splitting.service';
import { DocumentStorageService } from './services/document-storage.service';
import { DocumentPersistenceService } from './services/document-persistence.service';
import { ProcessingQueueService } from './services/processing-queue.service';

describe('DocumentSplitterService', () => {
  let service: DocumentSplitterService;
  let mockAgent: jest.Mocked<DocumentSplitterAgent>;
  let mockDuplicateDetection: jest.Mocked<DuplicateDetectionService>;
  let mockParsing: jest.Mocked<DocumentParsingService>;
  let mockSplitting: jest.Mocked<PdfSplittingService>;
  let mockStorage: jest.Mocked<DocumentStorageService>;
  let mockPersistence: jest.Mocked<DocumentPersistenceService>;
  let mockQueue: jest.Mocked<ProcessingQueueService>;

  beforeEach(async () => {
    const mockAgentImplementation = {
      analyzePages: jest.fn(),
    };

    const mockDuplicateImplementation = {
      checkForDuplicates: jest.fn(),
      storeFileHash: jest.fn(),
    };

    const mockParsingImplementation = {
      extractFullDocumentMarkdown: jest.fn(),
      parseMarkdownPages: jest.fn(),
      combinePageMarkdown: jest.fn(),
    };

    const mockSplittingImplementation = {
      validatePageAnalysis: jest.fn(),
      createSplitPdfFiles: jest.fn(),
    };

    const mockStorageImplementation = {
      getTempDirectory: jest.fn().mockReturnValue('/tmp/test'),
      saveFileTemporarily: jest.fn(),
      uploadSplitPdf: jest.fn(),
      cleanupTempDirectory: jest.fn(),
    };

    const mockPersistenceImplementation = {
      createOrGetExpenseDocument: jest.fn(),
      updateDocumentStatus: jest.fn(),
      getReceiptsByDocumentId: jest.fn(),
      createReceiptsInTransaction: jest.fn(),
    };

    const mockQueueImplementation = {
      enqueueReceiptProcessing: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSplitterService,
        {
          provide: DocumentSplitterAgent,
          useValue: mockAgentImplementation,
        },
        {
          provide: DuplicateDetectionService,
          useValue: mockDuplicateImplementation,
        },
        {
          provide: DocumentParsingService,
          useValue: mockParsingImplementation,
        },
        {
          provide: PdfSplittingService,
          useValue: mockSplittingImplementation,
        },
        {
          provide: DocumentStorageService,
          useValue: mockStorageImplementation,
        },
        {
          provide: DocumentPersistenceService,
          useValue: mockPersistenceImplementation,
        },
        {
          provide: ProcessingQueueService,
          useValue: mockQueueImplementation,
        },
      ],
    }).compile();

    service = module.get<DocumentSplitterService>(DocumentSplitterService);
    mockAgent = module.get(DocumentSplitterAgent);
    mockDuplicateDetection = module.get(DuplicateDetectionService);
    mockParsing = module.get(DocumentParsingService);
    mockSplitting = module.get(PdfSplittingService);
    mockStorage = module.get(DocumentStorageService);
    mockPersistence = module.get(DocumentPersistenceService);
    mockQueue = module.get(ProcessingQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have cleanup method', () => {
    expect(service.cleanupTempFiles).toBeDefined();
    expect(typeof service.cleanupTempFiles).toBe('function');
  });

  it('should call cleanupTempDirectory when cleanupTempFiles is called', async () => {
    const tempDir = '/tmp/test-dir';
    await service.cleanupTempFiles(tempDir);
    expect(mockStorage.cleanupTempDirectory).toHaveBeenCalledWith(tempDir);
  });

  // Note: Full integration tests would require actual PDF files and LLM API access
  // This is a basic structure test to ensure the service is properly configured
});
