import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DocumentSplitterService } from './document-splitter.service';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { DuplicateDetectionService } from '@/utils/duplicate-detection.service';
import { DocumentParsingService } from '@/services/document-parsing/document-parsing.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { DocumentPersistenceService } from './document-persistence.service';
import { ProcessingQueueService } from './processing-queue.service';
import { QUEUE_NAMES } from '@/common/constants/queue.constants';

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

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue: number) => defaultValue),
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
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.EXPENSE_WORKFLOW),
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

  // Note: Full integration tests would require actual PDF files and LLM API access
  // This is a basic structure test to ensure the service is properly configured
});
