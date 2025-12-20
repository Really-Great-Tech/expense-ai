import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidationOrchestratorService } from './validation-orchestrator.service';
import { ProcessingTiming } from './processing-metrics.service';

// Mock the validator classes
jest.mock('../../utils/judge/validation/ExpenseComplianceUQLMValidator');
jest.mock('../../utils/judge/validation/ParallelExpenseComplianceUQLMValidator');

import { ExpenseComplianceUQLMValidator } from '../../utils/judge/validation/ExpenseComplianceUQLMValidator';
import { ParallelExpenseComplianceUQLMValidator } from '../../utils/judge/validation/ParallelExpenseComplianceUQLMValidator';

describe('ValidationOrchestratorService', () => {
  let service: ValidationOrchestratorService;
  let configService: ConfigService;
  let mockParallelValidator: jest.Mocked<ParallelExpenseComplianceUQLMValidator>;
  let mockSequentialValidator: jest.Mocked<ExpenseComplianceUQLMValidator>;

  const createMockTiming = (): ProcessingTiming => ({
    phase_timings: {},
    agent_performance: {},
    total_processing_time_seconds: '0.0',
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    mockParallelValidator = {
      validateComplianceResponse: jest.fn(),
    } as any;
    // Set the correct prototype for instanceof checks
    Object.setPrototypeOf(mockParallelValidator, ParallelExpenseComplianceUQLMValidator.prototype);

    mockSequentialValidator = {
      validateComplianceResponse: jest.fn(),
    } as any;
    Object.setPrototypeOf(mockSequentialValidator, ExpenseComplianceUQLMValidator.prototype);

    (ParallelExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => mockParallelValidator);
    (ExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => mockSequentialValidator);
  });

  describe('initialization with parallel validation', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const config = {
                  PARALLEL_VALIDATION_ENABLED: 'true',
                  VALIDATION_DIMENSION_CONCURRENCY: '6',
                  VALIDATION_JUDGE_CONCURRENCY: '3',
                  BEDROCK_RATE_LIMIT_PER_SECOND: '10',
                };
                return config[key] || defaultValue;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
      configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with parallel validator', () => {
      expect(ParallelExpenseComplianceUQLMValidator).toHaveBeenCalled();
      expect(service['complianceValidator']).toBe(mockParallelValidator);
    });
  });

  describe('initialization with sequential validation', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'PARALLEL_VALIDATION_ENABLED') return 'false';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
    });

    it('should initialize with sequential validator', () => {
      expect(ExpenseComplianceUQLMValidator).toHaveBeenCalled();
      expect(service['complianceValidator']).toBe(mockSequentialValidator);
    });
  });

  describe('validateCompliance - with parallel validator', () => {
    let timing: ProcessingTiming;

    beforeEach(async () => {
      // Reset the mock implementation before each test
      (ParallelExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => mockParallelValidator);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const config = {
                  PARALLEL_VALIDATION_ENABLED: 'true',
                  VALIDATION_DIMENSION_CONCURRENCY: '6',
                  VALIDATION_JUDGE_CONCURRENCY: '3',
                  BEDROCK_RATE_LIMIT_PER_SECOND: '10',
                };
                return config[key] || defaultValue;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
      configService = module.get<ConfigService>(ConfigService);
      timing = createMockTiming();
    });

    it('should validate compliance successfully with parallel validator', async () => {
      const mockValidationResult = {
        overall_score: 0.95,
        overall_reliability: 'high',
        metadata: { judge_models: ['model1', 'model2'] },
        performance_metrics: {
          execution_mode: 'parallel',
          speedup_factor: 3.2,
        },
      };

      mockParallelValidator.validateComplianceResponse.mockResolvedValue(mockValidationResult as any);

      const mockCompliance = { validation_result: { is_valid: true } };
      const mockCountry = 'Germany';
      const mockExpenseType = 'invoice';
      const mockIcp = 'Global People';
      const mockComplianceData = { tax_rules: {} };
      const mockExtraction = { amount: 100 };

      await service.validateCompliance(
        mockCompliance,
        mockCountry,
        mockExpenseType,
        mockIcp,
        mockComplianceData,
        mockExtraction,
        timing,
      );

      expect(mockParallelValidator.validateComplianceResponse).toHaveBeenCalledWith(
        JSON.stringify(mockCompliance),
        mockCountry,
        mockExpenseType,
        mockIcp,
        mockComplianceData,
        mockExtraction,
      );

      expect(timing.phase_timings.llm_validation_seconds).toBeDefined();
      expect(timing.agent_performance.llm_validation).toBeDefined();
      expect(timing.agent_performance.llm_validation.execution_mode).toBe('parallel');
      expect(timing.agent_performance.llm_validation.validator_type).toBe('parallel');
    });

    it('should include performance metrics in timing', async () => {
      const mockValidationResult = {
        overall_score: 0.88,
        performance_metrics: {
          execution_mode: 'parallel',
          speedup_factor: 2.5,
          total_judges: 6,
        },
        metadata: { judge_models: ['model1'] },
      };

      mockParallelValidator.validateComplianceResponse.mockResolvedValue(mockValidationResult as any);

      await service.validateCompliance({}, 'US', 'receipt', 'ICP1', {}, {}, timing);

      expect(timing.agent_performance.llm_validation.parallel_metrics).toEqual(mockValidationResult.performance_metrics);
      expect(timing.agent_performance.llm_validation.judge_models_used).toEqual(['model1']);
    });
  });

  describe('validateCompliance - with sequential validator', () => {
    let timing: ProcessingTiming;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'PARALLEL_VALIDATION_ENABLED') return 'false';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
      timing = createMockTiming();
    });

    it('should validate compliance with sequential validator', async () => {
      const mockValidationResult = {
        overall_score: 0.92,
        overall_reliability: 'high',
        metadata: { judge_models: ['model1'] },
      };

      mockSequentialValidator.validateComplianceResponse.mockResolvedValue(mockValidationResult as any);

      await service.validateCompliance({}, 'UK', 'invoice', 'ICP2', {}, {}, timing);

      expect(mockSequentialValidator.validateComplianceResponse).toHaveBeenCalled();
      expect(timing.agent_performance.llm_validation.validator_type).toBe('sequential');
      expect(timing.agent_performance.llm_validation.execution_mode).toBe('sequential');
    });
  });

  describe('validateCompliance - error handling', () => {
    let timing: ProcessingTiming;

    beforeEach(async () => {
      // Reset the mock implementation before each test
      (ParallelExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => mockParallelValidator);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => 'true'),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
      timing = createMockTiming();
    });

    it('should handle validation errors gracefully', async () => {
      mockParallelValidator.validateComplianceResponse.mockRejectedValue(new Error('Validation service unavailable'));

      await service.validateCompliance({}, 'FR', 'receipt', 'ICP3', {}, {}, timing);

      expect(timing.phase_timings.llm_validation_seconds).toBe('0.0');
      expect(timing.agent_performance.llm_validation.error).toBe('Validation service unavailable');
      expect(timing.agent_performance.llm_validation.execution_mode).toBe('error');
    });

    it('should skip validation when validator not available', async () => {
      service['complianceValidator'] = null;

      await service.validateCompliance({}, 'ES', 'invoice', 'ICP4', {}, {}, timing);

      expect(timing.phase_timings.llm_validation_seconds).toBe('0.0');
      expect(timing.agent_performance.llm_validation).toBeUndefined();
    });
  });

  describe('validateComplianceResults - standalone validation', () => {
    beforeEach(async () => {
      // Reset the mock implementation before each test
      (ParallelExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => mockParallelValidator);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => 'true'),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
    });

    it('should validate compliance results successfully', async () => {
      const mockValidationResult = {
        overall_score: 0.96,
        overall_reliability: 'very_high',
        detailed_scores: { completeness: 0.98, accuracy: 0.94 },
      };

      mockParallelValidator.validateComplianceResponse.mockResolvedValue(mockValidationResult as any);

      const mockComplianceResult = { validation_result: { is_valid: true } };
      const result = await service.validateComplianceResults(
        mockComplianceResult,
        'IT',
        'invoice',
        'ICP5',
        { tax_rules: {} },
        { amount: 200 },
      );

      expect(mockParallelValidator.validateComplianceResponse).toHaveBeenCalledWith(
        JSON.stringify(mockComplianceResult),
        'IT',
        'invoice',
        'ICP5',
        { tax_rules: {} },
        { amount: 200 },
      );

      expect(result).toEqual(mockValidationResult);
    });

    it('should throw error when validator not available', async () => {
      service['complianceValidator'] = null;

      await expect(
        service.validateComplianceResults({}, 'PT', 'receipt', 'ICP6', {}, {}),
      ).rejects.toThrow('LLM-as-judge compliance validator not available');
    });

    it('should handle validation errors', async () => {
      mockParallelValidator.validateComplianceResponse.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        service.validateComplianceResults({}, 'NL', 'invoice', 'ICP7', {}, {}),
      ).rejects.toThrow('LLM validation failed: API rate limit exceeded');
    });
  });

  describe('initialization error handling', () => {
    it('should handle validator initialization errors', async () => {
      (ParallelExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to initialize validator');
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => 'true'),
            },
          },
        ],
      }).compile();

      const serviceWithError = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
      expect(serviceWithError['complianceValidator']).toBeNull();
    });
  });

  describe('timing accuracy', () => {
    let timing: ProcessingTiming;

    beforeEach(async () => {
      // Reset the mock implementation before each test
      (ParallelExpenseComplianceUQLMValidator as jest.Mock).mockImplementation(() => mockParallelValidator);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ValidationOrchestratorService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => 'true'),
            },
          },
        ],
      }).compile();

      service = module.get<ValidationOrchestratorService>(ValidationOrchestratorService);
      timing = createMockTiming();
    });

    it('should record accurate validation duration', async () => {
      const mockValidationResult = {
        overall_score: 0.90,
        metadata: { judge_models: [] },
        performance_metrics: { execution_mode: 'parallel' },
      };

      mockParallelValidator.validateComplianceResponse.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockValidationResult as any), 100)),
      );

      await service.validateCompliance({}, 'BE', 'receipt', 'ICP8', {}, {}, timing);

      const duration = parseFloat(timing.phase_timings.llm_validation_seconds);
      expect(duration).toBeGreaterThan(0.0);
      expect(duration).toBeLessThan(1.0);
    });

    it('should include ISO timestamps', async () => {
      mockParallelValidator.validateComplianceResponse.mockResolvedValue({
        overall_score: 0.85,
        metadata: { validation_version: '1.0' },
        performance_metrics: {},
      } as any);

      await service.validateCompliance({}, 'AT', 'invoice', 'ICP9', {}, {}, timing);

      expect(timing.agent_performance.llm_validation.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(timing.agent_performance.llm_validation.end_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
