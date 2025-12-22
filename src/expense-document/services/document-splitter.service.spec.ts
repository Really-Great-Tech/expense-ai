import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DocumentSplitterService } from './document-splitter.service';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { DuplicateDetectionService } from '@/utils/duplicate-detection.service';
import { DocumentParsingService } from '@/services/document-parsing/document-parsing.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { ProcessingQueueService } from './processing-queue.service';
import { QUEUE_NAMES } from '@/common/types';

describe('DocumentSplitterService', () => {
  let service: DocumentSplitterService;
  let mockAgent: jest.Mocked<DocumentSplitterAgent>;
  let mockDuplicateDetection: jest.Mocked<DuplicateDetectionService>;
  let mockParsing: jest.Mocked<DocumentParsingService>;
  let mockStorage: jest.Mocked<S3StorageService>;
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
      extractMarkdownFromBuffer: jest.fn(),
      parseMarkdownPages: jest.fn(),
      combinePageMarkdown: jest.fn(),
    };

    const mockStorageImplementation = {
      uploadOriginalDocument: jest.fn(),
      uploadOriginalFile: jest.fn(),
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

    const mockSplitterQueue = {
      add: jest.fn(),
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
          provide: S3StorageService,
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
        {
          provide: getQueueToken(QUEUE_NAMES.DOCUMENT_SPLITTING),
          useValue: mockSplitterQueue,
        },
      ],
    }).compile();

    service = module.get<DocumentSplitterService>(DocumentSplitterService);
    mockAgent = module.get(DocumentSplitterAgent);
    mockDuplicateDetection = module.get(DuplicateDetectionService);
    mockParsing = module.get(DocumentParsingService);
    mockStorage = module.get(S3StorageService);
    mockPersistence = module.get(DocumentPersistenceService);
    mockQueue = module.get(ProcessingQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have cleanup method (deprecated no-op)', () => {
    expect(service.cleanupTempFiles).toBeDefined();
    expect(typeof service.cleanupTempFiles).toBe('function');
  });

  it('cleanupTempFiles should be a no-op (no temp files in new architecture)', async () => {
    const tempDir = '/tmp/test-dir';
    // Should complete without errors (no-op)
    await expect(service.cleanupTempFiles(tempDir)).resolves.not.toThrow();
  });

  // Note: Full integration tests would require actual PDF files and LLM API access
  // This is a basic structure test to ensure the service is properly configured
});
