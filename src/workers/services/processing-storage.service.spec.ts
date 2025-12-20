import { Test, TestingModule } from '@nestjs/testing';
import { ProcessingStorageService } from './processing-storage.service';
import { FileStorageService } from '../../storage/interfaces/file-storage.interface';

describe('ProcessingStorageService', () => {
  let service: ProcessingStorageService;
  let mockStorageService: jest.Mocked<Partial<FileStorageService>>;

  beforeEach(async () => {
    mockStorageService = {
      saveResult: jest.fn(),
      saveValidationResult: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingStorageService,
        {
          provide: 'FILE_STORAGE_SERVICE',
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<ProcessingStorageService>(ProcessingStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('saveResults', () => {
    const mockResult = {
      classification: { is_expense: true, expense_type: 'invoice' },
      extraction: { supplier_name: 'Test Co', amount: 100 },
      compliance: { validation_result: { is_valid: true } },
      citations: { citations: [] },
      timing: { total_processing_time_seconds: '2.5' },
    };
    const mockFilename = 'test-invoice.pdf';

    it('should save results successfully', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);

      await service.saveResults(mockFilename, mockResult);

      expect(mockStorageService.saveResult).toHaveBeenCalledTimes(1);
      expect(mockStorageService.saveResult).toHaveBeenCalledWith('test-invoice_result.json', mockResult);
    });

    it('should extract base filename correctly', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);

      await service.saveResults('path/to/invoice-2024.pdf', mockResult);

      expect(mockStorageService.saveResult).toHaveBeenCalledWith('invoice-2024_result.json', mockResult);
    });

    it('should handle filenames with multiple dots', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);

      await service.saveResults('invoice.final.v2.pdf', mockResult);

      expect(mockStorageService.saveResult).toHaveBeenCalledWith('invoice.final.v2_result.json', mockResult);
    });

    it('should handle storage errors gracefully without throwing', async () => {
      mockStorageService.saveResult.mockRejectedValue(new Error('S3 connection failed'));

      await expect(service.saveResults(mockFilename, mockResult)).resolves.toBeUndefined();
      expect(mockStorageService.saveResult).toHaveBeenCalled();
    });

    it('should log success message', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.saveResults(mockFilename, mockResult);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Results saved'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-invoice_result.json'));
    });

    it('should log error on failure', async () => {
      mockStorageService.saveResult.mockRejectedValue(new Error('Storage failure'));
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.saveResults(mockFilename, mockResult);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save results'), expect.any(Error));
    });
  });

  describe('saveValidationResults', () => {
    const mockValidationResult = {
      overall_score: 0.95,
      overall_reliability: 'high',
      detailed_scores: { completeness: 0.98, accuracy: 0.92 },
    };
    const mockFilename = 'test-invoice.pdf';

    it('should save validation results successfully', async () => {
      mockStorageService.saveValidationResult.mockResolvedValue(undefined);

      await service.saveValidationResults(mockFilename, mockValidationResult);

      expect(mockStorageService.saveValidationResult).toHaveBeenCalledTimes(1);
      expect(mockStorageService.saveValidationResult).toHaveBeenCalledWith(
        'test-invoice_llm_validation.json',
        mockValidationResult,
      );
    });

    it('should extract base filename correctly', async () => {
      mockStorageService.saveValidationResult.mockResolvedValue(undefined);

      await service.saveValidationResults('path/to/receipt-001.pdf', mockValidationResult);

      expect(mockStorageService.saveValidationResult).toHaveBeenCalledWith(
        'receipt-001_llm_validation.json',
        mockValidationResult,
      );
    });

    it('should handle filenames with complex paths', async () => {
      mockStorageService.saveValidationResult.mockResolvedValue(undefined);

      await service.saveValidationResults('/var/uploads/2024/invoice.pdf', mockValidationResult);

      expect(mockStorageService.saveValidationResult).toHaveBeenCalledWith('invoice_llm_validation.json', mockValidationResult);
    });

    it('should handle storage errors gracefully without throwing', async () => {
      mockStorageService.saveValidationResult.mockRejectedValue(new Error('Storage quota exceeded'));

      await expect(service.saveValidationResults(mockFilename, mockValidationResult)).resolves.toBeUndefined();
      expect(mockStorageService.saveValidationResult).toHaveBeenCalled();
    });

    it('should log success message', async () => {
      mockStorageService.saveValidationResult.mockResolvedValue(undefined);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.saveValidationResults(mockFilename, mockValidationResult);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('LLM validation results saved'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-invoice_llm_validation.json'));
    });

    it('should log error on failure', async () => {
      mockStorageService.saveValidationResult.mockRejectedValue(new Error('Validation save failed'));
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.saveValidationResults(mockFilename, mockValidationResult);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save LLM validation results'),
        expect.any(Error),
      );
    });
  });

  describe('error handling', () => {
    it('should not throw errors on save failure', async () => {
      mockStorageService.saveResult.mockRejectedValue(new Error('Network timeout'));

      await expect(service.saveResults('test.pdf', { data: 'test' })).resolves.toBeUndefined();
    });

    it('should not throw errors on validation save failure', async () => {
      mockStorageService.saveValidationResult.mockRejectedValue(new Error('Network timeout'));

      await expect(service.saveValidationResults('test.pdf', { score: 0.9 })).resolves.toBeUndefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent saves', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);

      const operations = Array.from({ length: 10 }, (_, i) =>
        service.saveResults(`file${i}.pdf`, { test: i }),
      );

      await expect(Promise.all(operations)).resolves.toBeDefined();
      expect(mockStorageService.saveResult).toHaveBeenCalledTimes(10);
    });

    it('should handle mixed success and failure scenarios', async () => {
      let callCount = 0;
      mockStorageService.saveResult.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Intermittent failure'));
        }
        return Promise.resolve(undefined);
      });

      await Promise.all([
        service.saveResults('file1.pdf', { id: 1 }),
        service.saveResults('file2.pdf', { id: 2 }),
        service.saveResults('file3.pdf', { id: 3 }),
      ]);

      expect(mockStorageService.saveResult).toHaveBeenCalledTimes(3);
    });
  });

  describe('filename edge cases', () => {
    it('should handle filename without extension', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);

      await service.saveResults('invoice', { data: 'test' });

      expect(mockStorageService.saveResult).toHaveBeenCalledWith('invoice_result.json', { data: 'test' });
    });

    it('should handle filename with special characters', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);

      await service.saveResults('invoice-2024_final (1).pdf', { data: 'test' });

      expect(mockStorageService.saveResult).toHaveBeenCalledWith('invoice-2024_final (1)_result.json', { data: 'test' });
    });

    it('should handle very long filenames', async () => {
      mockStorageService.saveResult.mockResolvedValue(undefined);
      const longName = 'a'.repeat(200) + '.pdf';

      await service.saveResults(longName, { data: 'test' });

      expect(mockStorageService.saveResult).toHaveBeenCalledWith(`${'a'.repeat(200)}_result.json`, { data: 'test' });
    });
  });
});
