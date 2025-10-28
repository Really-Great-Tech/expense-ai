import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DuplicateDetectionService, DuplicateCheckRequest } from './duplicate-detection.service';
import { FileHash } from '../../document/entities/file-hash.entity';
import { DocumentReference } from '../../document/entities/document-reference.entity';
import { ExpenseDocument } from '../../document/entities/expense-document.entity';

// Note: Uses mocked repositories - safe to run in CI
describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;
  let fileHashRepository: Repository<FileHash>;
  let documentReferenceRepository: Repository<DocumentReference>;
  let expenseDocumentRepository: Repository<ExpenseDocument>;

  const mockFileHashRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDocumentReferenceRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockExpenseDocumentRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicateDetectionService,
        {
          provide: getRepositoryToken(FileHash),
          useValue: mockFileHashRepository,
        },
        {
          provide: getRepositoryToken(DocumentReference),
          useValue: mockDocumentReferenceRepository,
        },
        {
          provide: getRepositoryToken(ExpenseDocument),
          useValue: mockExpenseDocumentRepository,
        },
      ],
    }).compile();

    service = module.get<DuplicateDetectionService>(DuplicateDetectionService);
    fileHashRepository = module.get<Repository<FileHash>>(getRepositoryToken(FileHash));
    documentReferenceRepository = module.get<Repository<DocumentReference>>(getRepositoryToken(DocumentReference));
    expenseDocumentRepository = module.get<Repository<ExpenseDocument>>(getRepositoryToken(ExpenseDocument));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateFileHash', () => {
    it('should generate SHA-256 hash for file content', async () => {
      const testBuffer = Buffer.from('test content');
      const hash = await service.generateFileHash(testBuffer);
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 produces 64-character hex string
      expect(hash).toBe('6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72');
    });

    it('should generate consistent hashes for same content', async () => {
      const testBuffer = Buffer.from('test content');
      const hash1 = await service.generateFileHash(testBuffer);
      const hash2 = await service.generateFileHash(testBuffer);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', async () => {
      const buffer1 = Buffer.from('test content 1');
      const buffer2 = Buffer.from('test content 2');
      const hash1 = await service.generateFileHash(buffer1);
      const hash2 = await service.generateFileHash(buffer2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('checkForDuplicates', () => {
    it('should detect content identical duplicate', async () => {
      const mockFileHash = {
        id: 1,
        hash: 'test-hash',
        originalFilename: 'test.pdf',
        document: { id: 'existing-doc-id' },
      };

      mockFileHashRepository.findOne.mockResolvedValue(mockFileHash);

      const request: DuplicateCheckRequest = {
        fileBuffer: Buffer.from('test content'),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        userId: 'user123',
      };

      const result = await service.checkForDuplicates(request);

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateType).toBe('CONTENT_IDENTICAL');
      expect(result.confidence).toBe(1.0);
    });

    it('should return no duplicate when no matches found', async () => {
      mockFileHashRepository.findOne.mockResolvedValue(null);
      
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      
      mockFileHashRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const request: DuplicateCheckRequest = {
        fileBuffer: Buffer.from('unique content'),
        filename: 'unique.pdf',
        mimeType: 'application/pdf',
        userId: 'user123',
      };

      const result = await service.checkForDuplicates(request);

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateType).toBeNull();
      expect(result.recommendation).toBe('PROCEED');
    });
  });

  describe('storeFileHash', () => {
    it('should create new file hash record', async () => {
      mockFileHashRepository.findOne.mockResolvedValue(null);
      
      const mockCreatedHash = { id: 1, hash: 'test-hash' };
      mockFileHashRepository.create.mockReturnValue(mockCreatedHash);
      mockFileHashRepository.save.mockResolvedValue(mockCreatedHash);

      const params = {
        hash: 'test-hash',
        originalFilename: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        documentId: 'doc-123',
      };

      const result = await service.storeFileHash(params);

      expect(mockFileHashRepository.create).toHaveBeenCalled();
      expect(mockFileHashRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedHash);
    });

    it('should update existing file hash record', async () => {
      const existingHash = {
        id: 1,
        hash: 'test-hash',
        uploadCount: 1,
        lastUploadedAt: new Date('2024-01-01'),
      };
      
      mockFileHashRepository.findOne.mockResolvedValue(existingHash);
      mockFileHashRepository.save.mockResolvedValue({
        ...existingHash,
        uploadCount: 2,
      });

      const params = {
        hash: 'test-hash',
        originalFilename: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        documentId: 'doc-123',
      };

      const result = await service.storeFileHash(params);

      expect(result.uploadCount).toBe(2);
      expect(mockFileHashRepository.save).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully in checkForDuplicates', async () => {
      mockFileHashRepository.findOne.mockRejectedValue(new Error('Database error'));

      const request: DuplicateCheckRequest = {
        fileBuffer: Buffer.from('test content'),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        userId: 'user123',
      };

      const result = await service.checkForDuplicates(request);

      // Should return safe fallback
      expect(result.isDuplicate).toBe(false);
      expect(result.recommendation).toBe('PROCEED');
      expect(result.confidence).toBe(0);
    });
  });
});
