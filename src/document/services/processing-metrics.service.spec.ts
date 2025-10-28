import { Test, TestingModule } from '@nestjs/testing';
import { ProcessingMetricsService, ProcessingTiming } from './processing-metrics.service';

describe('ProcessingMetricsService', () => {
  let service: ProcessingMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessingMetricsService],
    }).compile();

    service = module.get<ProcessingMetricsService>(ProcessingMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createTimingObject', () => {
    it('should create timing object without markdown extraction info', () => {
      const { timing, trueStartTime } = service.createTimingObject();

      expect(timing).toBeDefined();
      expect(timing.phase_timings).toEqual({});
      expect(timing.agent_performance).toEqual({});
      expect(timing.total_processing_time_seconds).toBe('0.0');
      expect(trueStartTime).toBeGreaterThan(Date.now() - 1000);
      expect(trueStartTime).toBeLessThanOrEqual(Date.now());
    });

    it('should create timing object with markdown extraction info', () => {
      const markdownExtractionInfo = {
        markdownExtractionTime: 5000,
        documentReader: 'textract',
      };

      const beforeCall = Date.now();
      const { timing, trueStartTime } = service.createTimingObject(markdownExtractionInfo);
      const afterCall = Date.now();

      expect(timing.phase_timings.markdown_extraction_seconds).toBe('5.0');
      expect(timing.agent_performance.markdown_extraction).toBeDefined();
      expect(timing.agent_performance.markdown_extraction.duration_seconds).toBe('5.0');
      expect(timing.agent_performance.markdown_extraction.document_reader_used).toBe('textract');
      // Allow 10ms tolerance for timing
      expect(trueStartTime).toBeGreaterThanOrEqual(beforeCall - 5000 - 10);
      expect(trueStartTime).toBeLessThanOrEqual(afterCall - 5000 + 10);
    });

    it('should calculate correct true start time with markdown extraction', () => {
      const now = Date.now();
      const extractionTime = 3000;
      const markdownExtractionInfo = {
        markdownExtractionTime: extractionTime,
        documentReader: 'textract',
      };

      const { trueStartTime } = service.createTimingObject(markdownExtractionInfo);

      // Should be approximately 3 seconds ago
      expect(trueStartTime).toBeGreaterThan(now - extractionTime - 100);
      expect(trueStartTime).toBeLessThan(now - extractionTime + 100);
    });
  });

  describe('recordPhase', () => {
    let timing: ProcessingTiming;

    beforeEach(() => {
      const result = service.createTimingObject();
      timing = result.timing;
    });

    it('should record phase with correct duration', () => {
      const startTime = Date.now() - 2500;
      const endTime = Date.now();

      service.recordPhase(timing, 'test_phase', startTime, endTime);

      expect(timing.phase_timings.test_phase_seconds).toBe('2.5');
      expect(timing.agent_performance.test_phase).toBeDefined();
      expect(timing.agent_performance.test_phase.duration_seconds).toBe('2.5');
      expect(timing.agent_performance.test_phase.execution_mode).toBe('parallel');
    });

    it('should record phase with additional metrics', () => {
      const startTime = Date.now() - 1000;
      const endTime = Date.now();
      const additionalMetrics = {
        model_used: 'test-model',
        custom_metric: 'test-value',
      };

      service.recordPhase(timing, 'test_phase', startTime, endTime, additionalMetrics);

      expect(timing.agent_performance.test_phase.model_used).toBe('test-model');
      expect(timing.agent_performance.test_phase.custom_metric).toBe('test-value');
      expect(timing.agent_performance.test_phase.execution_mode).toBe('parallel');
    });

    it('should format duration to one decimal place', () => {
      const endTime = 1000000000;
      const startTime = endTime - 1234;

      service.recordPhase(timing, 'test_phase', startTime, endTime);

      expect(timing.phase_timings.test_phase_seconds).toBe('1.2');
    });

    it('should include ISO timestamps', () => {
      const startTime = Date.now() - 1000;
      const endTime = Date.now();

      service.recordPhase(timing, 'test_phase', startTime, endTime);

      expect(timing.agent_performance.test_phase.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(timing.agent_performance.test_phase.end_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('addParallelGroupMetrics', () => {
    let timing: ProcessingTiming;

    beforeEach(() => {
      const result = service.createTimingObject();
      timing = result.timing;
    });

    it('should add parallel group metrics', () => {
      service.addParallelGroupMetrics(timing, 2.5, 1.8);

      expect(timing.performance_metrics).toBeDefined();
      expect(timing.performance_metrics.parallel_group_1_seconds).toBe('2.5');
      expect(timing.performance_metrics.parallel_group_2_seconds).toBe('1.8');
      expect(timing.performance_metrics.total_parallel_time_seconds).toBe('4.3');
    });

    it('should format metrics to one decimal place', () => {
      service.addParallelGroupMetrics(timing, 2.567, 1.834);

      expect(timing.performance_metrics.parallel_group_1_seconds).toBe('2.6');
      expect(timing.performance_metrics.parallel_group_2_seconds).toBe('1.8');
      expect(timing.performance_metrics.total_parallel_time_seconds).toBe('4.4');
    });

    it('should handle zero durations', () => {
      service.addParallelGroupMetrics(timing, 0, 0);

      expect(timing.performance_metrics.total_parallel_time_seconds).toBe('0.0');
    });
  });

  describe('finalizeTiming', () => {
    let timing: ProcessingTiming;
    let trueStartTime: number;

    beforeEach(() => {
      const result = service.createTimingObject();
      timing = result.timing;
      trueStartTime = result.trueStartTime;
    });

    it('should calculate total processing time', () => {
      // Simulate some time passing
      const delay = 100;
      const startTime = Date.now() - delay;

      service.finalizeTiming(timing, startTime);

      const totalTime = parseFloat(timing.total_processing_time_seconds);
      expect(totalTime).toBeGreaterThan(0.0);
      expect(totalTime).toBeLessThan(1.0); // Should be less than 1 second
    });

    it('should format total time to one decimal place', () => {
      const startTime = Date.now() - 2567;

      service.finalizeTiming(timing, startTime);

      // Should be approximately 2.6 seconds
      const totalTime = parseFloat(timing.total_processing_time_seconds);
      expect(totalTime).toBeGreaterThan(2.4);
      expect(totalTime).toBeLessThan(2.8);
      expect(timing.total_processing_time_seconds).toMatch(/^\d+\.\d$/);
    });
  });

  describe('validateTimingConsistency', () => {
    let timing: ProcessingTiming;

    beforeEach(() => {
      const result = service.createTimingObject();
      timing = result.timing;
      timing.total_processing_time_seconds = '10.0';
    });

    it('should log success for parallel mode', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.validateTimingConsistency(timing, 5.0, 3.0);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed in 10.0s'));
    });

    it('should validate sequential mode within tolerance', () => {
      timing.phase_timings = {
        phase1_seconds: '4.0',
        phase2_seconds: '3.0',
        phase3_seconds: '2.8',
      };

      const logSpy = jest.spyOn(service['logger'], 'log');

      service.validateTimingConsistency(timing);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Timing validation passed'));
    });

    it('should warn on timing inconsistency in sequential mode', () => {
      timing.phase_timings = {
        phase1_seconds: '4.0',
        phase2_seconds: '3.0',
      };
      timing.total_processing_time_seconds = '15.0'; // Inconsistent

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      service.validateTimingConsistency(timing);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Timing inconsistency detected'));
    });

    it('should handle empty phase timings', () => {
      timing.phase_timings = {};

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      service.validateTimingConsistency(timing);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Timing inconsistency detected'));
    });

    it('should handle errors gracefully', () => {
      timing.phase_timings = { invalid: 'not-a-number' as any };
      timing.total_processing_time_seconds = 'also-invalid';

      // Don't spy on logger, just ensure it doesn't throw
      expect(() => service.validateTimingConsistency(timing)).not.toThrow();
      
      // The function should handle invalid data without crashing
      // We already tested the success cases, this just verifies graceful handling
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete processing workflow', () => {
      // Create timing object
      const { timing, trueStartTime } = service.createTimingObject({
        markdownExtractionTime: 1000,
        documentReader: 'textract',
      });

      // Record phases
      const phase1Start = Date.now() - 2000;
      const phase1End = Date.now() - 1500;
      service.recordPhase(timing, 'classification', phase1Start, phase1End, {
        model_used: 'nova-pro',
      });

      const phase2Start = Date.now() - 1500;
      const phase2End = Date.now();
      service.recordPhase(timing, 'extraction', phase2Start, phase2End, {
        model_used: 'nova-pro',
      });

      // Add parallel metrics
      service.addParallelGroupMetrics(timing, 2.5, 1.5);

      // Finalize
      service.finalizeTiming(timing, trueStartTime);

      // Validate
      service.validateTimingConsistency(timing, 2.5, 1.5);

      // Assertions
      expect(timing.phase_timings.markdown_extraction_seconds).toBe('1.0');
      expect(timing.phase_timings.classification_seconds).toBeDefined();
      expect(timing.phase_timings.extraction_seconds).toBeDefined();
      expect(timing.performance_metrics).toBeDefined();
      expect(parseFloat(timing.total_processing_time_seconds)).toBeGreaterThan(0);
    });
  });
});
