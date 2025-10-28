import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseProcessingService } from './processing.service';
import { AgentFactoryService } from './services/agent-factory.service';
import { ProcessingMetricsService } from './services/processing-metrics.service';
import { ProcessingStorageService } from './services/processing-storage.service';
import { ValidationOrchestratorService } from './services/validation-orchestrator.service';
import { StorageResolverService } from '@/storage/services/storage-resolver.service';

describe('ExpenseProcessingService', () => {
  let service: ExpenseProcessingService;
  let mockAgentFactory: jest.Mocked<AgentFactoryService>;
  let mockMetricsService: jest.Mocked<ProcessingMetricsService>;
  let mockStorageService: jest.Mocked<ProcessingStorageService>;
  let mockValidationOrchestrator: jest.Mocked<ValidationOrchestratorService>;
  let mockStorageResolver: jest.Mocked<StorageResolverService>;

  const mockAgents = {
    imageQualityAssessmentAgent: {
      assessImageQuality: jest.fn(),
      formatAssessmentForWorkflow: jest.fn(),
    },
    fileClassificationAgent: {
      classifyFile: jest.fn(),
      getActualModelUsed: jest.fn().mockReturnValue('claude-3-5-sonnet-20241022'),
    },
    dataExtractionAgent: {
      extractData: jest.fn(),
      getActualModelUsed: jest.fn().mockReturnValue('claude-3-5-sonnet-20241022'),
    },
    issueDetectionAgent: {
      analyzeCompliance: jest.fn(),
      getActualModelUsed: jest.fn().mockReturnValue('claude-3-5-sonnet-20241022'),
    },
    citationGeneratorAgent: {
      generateCitations: jest.fn(),
      getActualModelUsed: jest.fn().mockReturnValue('claude-3-5-sonnet-20241022'),
    },
  };

  beforeEach(async () => {
    mockAgentFactory = {
      getAgents: jest.fn().mockReturnValue(mockAgents),
    } as any;

    mockMetricsService = {
      createTimingObject: jest.fn().mockReturnValue({
        timing: {
          total_processing_time_seconds: '0',
          image_quality_assessment_time_seconds: '0',
          file_classification_time_seconds: '0',
          data_extraction_time_seconds: '0',
          issue_detection_time_seconds: '0',
          citation_generation_time_seconds: '0',
        },
        trueStartTime: Date.now(),
      }),
      recordPhase: jest.fn(),
      addParallelGroupMetrics: jest.fn(),
      finalizeTiming: jest.fn(),
      validateTimingConsistency: jest.fn(),
    } as any;

    mockStorageService = {
      saveResults: jest.fn().mockResolvedValue(undefined),
      saveValidationResults: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockValidationOrchestrator = {
      validateCompliance: jest.fn().mockResolvedValue(undefined),
      validateComplianceResults: jest.fn().mockResolvedValue({
        overall_score: 0.95,
        overall_reliability: 'high',
      }),
    } as any;

    mockStorageResolver = {
      buildStorageMetadata: jest.fn(),
      resolveStorageService: jest.fn(),
      getPhysicalPath: jest.fn().mockResolvedValue({
        path: '/tmp/test-path',
        isTemp: false,
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseProcessingService,
        {
          provide: AgentFactoryService,
          useValue: mockAgentFactory,
        },
        {
          provide: ProcessingMetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: ProcessingStorageService,
          useValue: mockStorageService,
        },
        {
          provide: ValidationOrchestratorService,
          useValue: mockValidationOrchestrator,
        },
        {
          provide: StorageResolverService,
          useValue: mockStorageResolver,
        },
      ],
    }).compile();

    service = module.get<ExpenseProcessingService>(ExpenseProcessingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processExpenseDocument', () => {
    const mockMarkdownContent = `# Invoice
    
Company: Test Company Ltd
Amount: €100.50
Date: 2024-01-15
Tax: €19.00`;

    const mockFileName = 'test-invoice.pdf';
    const mockImagePath = './uploads/test-invoice.pdf';
    const mockCountry = 'Germany';
    const mockIcp = 'Global People';
    const mockComplianceData = {
      required_fields: ['supplier_name', 'amount', 'date'],
      tax_rules: { vat_rate: 0.19 },
    };
    const mockExpenseSchema = {
      expense_types: ['invoice', 'receipt'],
      required_fields: ['supplier_name', 'amount'],
    };

    beforeEach(() => {
      mockAgents.imageQualityAssessmentAgent.assessImageQuality.mockResolvedValue({
        overall_quality: 'good',
      });
      mockAgents.imageQualityAssessmentAgent.formatAssessmentForWorkflow.mockReturnValue({
        overall_quality: 'good',
        model_used: 'claude-3-5-sonnet-20241022',
      });
      mockAgents.fileClassificationAgent.classifyFile.mockResolvedValue({
        is_expense: true,
        expense_type: 'invoice',
        language: 'English',
      });
      mockAgents.dataExtractionAgent.extractData.mockResolvedValue({
        supplier_name: 'Test Company Ltd',
        amount: 100.5,
        date: '2024-01-15',
      });
      mockAgents.issueDetectionAgent.analyzeCompliance.mockResolvedValue({
        validation_result: {
          is_valid: true,
          issues_count: 0,
          issues: [],
        },
      });
      mockAgents.citationGeneratorAgent.generateCitations.mockResolvedValue({
        citations: [],
      });
    });

    it('should be defined and have the correct method signature', () => {
      expect(service).toBeDefined();
      expect(typeof service.processExpenseDocument).toBe('function');
    });

    it('should process expense document successfully', async () => {
      const result = await service.processExpenseDocument(
        mockMarkdownContent,
        mockFileName,
        mockImagePath,
        mockCountry,
        mockIcp,
        mockComplianceData,
        mockExpenseSchema,
      );

      expect(result).toBeDefined();
      expect(result.classification).toBeDefined();
      expect(result.extraction).toBeDefined();
      expect(result.metadata.filename).toBe(mockFileName);
      expect(mockStorageService.saveResults).toHaveBeenCalled();
    });

    it('should handle progress callback', async () => {
      const progressCallback = jest.fn();

      await service.processExpenseDocument(
        mockMarkdownContent,
        mockFileName,
        mockImagePath,
        mockCountry,
        mockIcp,
        mockComplianceData,
        mockExpenseSchema,
        progressCallback,
      );

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should handle userId parameter', async () => {
      const userId = 'test-user';

      await service.processExpenseDocument(
        mockMarkdownContent,
        mockFileName,
        mockImagePath,
        mockCountry,
        mockIcp,
        mockComplianceData,
        mockExpenseSchema,
        undefined,
        undefined,
        userId,
      );

      expect(mockAgentFactory.getAgents).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockAgents.fileClassificationAgent.classifyFile.mockRejectedValue(
        new Error('Classification failed'),
      );

      await expect(
        service.processExpenseDocument(
          mockMarkdownContent,
          mockFileName,
          mockImagePath,
          mockCountry,
          mockIcp,
          mockComplianceData,
          mockExpenseSchema,
        ),
      ).rejects.toThrow('Parallel expense processing failed');
    });
  });

  describe('validateComplianceResults', () => {
    const mockComplianceResult = {
      validation_result: {
        is_valid: true,
        issues_count: 0,
        issues: [],
      },
    };
    const mockCountry = 'Germany';
    const mockReceiptType = 'invoice';
    const mockIcp = 'Global People';
    const mockComplianceData = { tax_rules: { vat_rate: 0.19 } };
    const mockExtractedData = { supplier_name: 'Test Co', amount: 100 };
    const mockFileName = 'test.pdf';

    it('should validate compliance results successfully', async () => {
      const mockValidationResult = {
        overall_score: 0.95,
        overall_reliability: 'high',
        detailed_scores: { completeness: 0.98, accuracy: 0.92 },
      };

      mockValidationOrchestrator.validateComplianceResults.mockResolvedValue(
        mockValidationResult,
      );

      const result = await service.validateComplianceResults(
        mockComplianceResult,
        mockCountry,
        mockReceiptType,
        mockIcp,
        mockComplianceData,
        mockExtractedData,
        mockFileName,
      );

      expect(mockValidationOrchestrator.validateComplianceResults).toHaveBeenCalledWith(
        mockComplianceResult,
        mockCountry,
        mockReceiptType,
        mockIcp,
        mockComplianceData,
        mockExtractedData,
      );

      expect(result).toEqual(mockValidationResult);
      expect(mockStorageService.saveValidationResults).toHaveBeenCalledWith(
        mockFileName,
        mockValidationResult,
      );
    });

    it('should handle validation without filename', async () => {
      const mockValidationResult = { overall_score: 0.88 };

      mockValidationOrchestrator.validateComplianceResults.mockResolvedValue(
        mockValidationResult,
      );

      const result = await service.validateComplianceResults(
        mockComplianceResult,
        mockCountry,
        mockReceiptType,
        mockIcp,
        mockComplianceData,
        mockExtractedData,
      );

      expect(result).toEqual(mockValidationResult);
      expect(mockStorageService.saveValidationResults).not.toHaveBeenCalled();
    });
  });

  describe('service initialization', () => {
    it('should initialize with correct dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should have agent factory available', () => {
      expect(mockAgentFactory).toBeDefined();
    });
  });
});
