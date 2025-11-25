import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpenseComplianceUQLMValidator } from '../../utils/judge/validation/ExpenseComplianceUQLMValidator';
import { ParallelExpenseComplianceUQLMValidator } from '../../utils/judge/validation/ParallelExpenseComplianceUQLMValidator';
import { ProcessingTiming } from './processing-metrics.service';

@Injectable()
export class ValidationOrchestratorService {
  private readonly logger = new Logger(ValidationOrchestratorService.name);
  private complianceValidator: ExpenseComplianceUQLMValidator | ParallelExpenseComplianceUQLMValidator;

  constructor(private readonly configService: ConfigService) {
    this.initializeValidator();
  }

  private initializeValidator(): void {
    try {
      const useParallelValidation = this.configService.get<string>('PARALLEL_VALIDATION_ENABLED', 'true') !== 'false';

      if (useParallelValidation) {
        this.logger.log(' Initializing PARALLEL LLM-as-judge compliance validator...');
        this.complianceValidator = new ParallelExpenseComplianceUQLMValidator(this.logger, this.configService);
        this.logger.log(' PARALLEL LLM-as-judge compliance validator initialized successfully');
        this.logger.log(' Parallel Configuration:');
        this.logger.log(`   - Dimension Concurrency: ${this.configService.get<string>('VALIDATION_DIMENSION_CONCURRENCY', '6')}`);
        this.logger.log(`   - Judge Concurrency: ${this.configService.get<string>('VALIDATION_JUDGE_CONCURRENCY', '3')}`);
        this.logger.log(`   - Rate Limit: ${this.configService.get<string>('BEDROCK_RATE_LIMIT_PER_SECOND', '10')} req/sec`);
      } else {
        this.logger.log(' Initializing SEQUENTIAL LLM-as-judge compliance validator...');
        this.complianceValidator = new ExpenseComplianceUQLMValidator(this.logger, this.configService);
        this.logger.log(' Sequential LLM-as-judge compliance validator initialized successfully');
      }
    } catch (error) {
      this.logger.error(' Failed to initialize LLM-as-judge compliance validator:', error);
      this.logger.error('Stack trace:', error.stack);
      this.complianceValidator = null;
    }
  }

  async validateCompliance(
    compliance: any,
    country: string,
    expenseType: string,
    icp: string,
    complianceData: any,
    extraction: any,
    timing: ProcessingTiming,
  ): Promise<void> {
    if (!this.complianceValidator) {
      this.logger.warn('️ LLM-as-judge validation skipped (validator not available)');
      timing.phase_timings.llm_validation_seconds = '0.0';
      return;
    }

    try {
      const validationStart = Date.now();

      const isParallelValidator = this.complianceValidator instanceof ParallelExpenseComplianceUQLMValidator;
      const parallelEnabled = this.configService.get<string>('PARALLEL_VALIDATION_ENABLED', 'true') !== 'false';

      this.logger.log(' Phase 5: LLM-as-Judge Validation');
      this.logger.log(
        ` Validator Type: ${isParallelValidator ? 'ParallelExpenseComplianceUQLMValidator' : 'ExpenseComplianceUQLMValidator'}`,
      );
      this.logger.log(` Parallel Processing: ${parallelEnabled ? 'ENABLED' : 'DISABLED'}`);

      let executionMode = 'sequential';
      if (isParallelValidator && parallelEnabled) {
        this.logger.log(' STARTING PARALLEL LLM VALIDATION');
        this.logger.log(' Configuration:');
        this.logger.log(`   - Dimension Concurrency: ${this.configService.get<string>('VALIDATION_DIMENSION_CONCURRENCY', '6')}`);
        this.logger.log(`   - Judge Concurrency: ${this.configService.get<string>('VALIDATION_JUDGE_CONCURRENCY', '3')}`);
        this.logger.log(`   - Rate Limit: ${this.configService.get<string>('BEDROCK_RATE_LIMIT_PER_SECOND', '10')} req/sec`);
        executionMode = 'parallel';
      } else {
        this.logger.log(' Using sequential validation');
      }

      this.logger.log('️ Starting validation execution...');
      const validationResult = await this.complianceValidator.validateComplianceResponse(
        JSON.stringify(compliance),
        country,
        expenseType,
        icp,
        complianceData,
        extraction,
      );
      const validationEnd = Date.now();
      const llmValidationTime = validationEnd - validationStart;

      const parallelResult = validationResult as any;
      let parallelMetrics = {};
      if (parallelResult.performance_metrics) {
        parallelMetrics = parallelResult.performance_metrics;
        executionMode = parallelResult.performance_metrics.execution_mode || executionMode;

        this.logger.log(` Validation completed in ${(llmValidationTime / 1000).toFixed(2)}s (${executionMode} mode)`);

        if (parallelResult.performance_metrics.speedup_factor) {
          this.logger.log(` Speedup: ${parallelResult.performance_metrics.speedup_factor}x faster`);
        }
      }

      timing.phase_timings.llm_validation_seconds = (llmValidationTime / 1000).toFixed(1);
      timing.agent_performance.llm_validation = {
        start_time: new Date(validationStart).toISOString(),
        end_time: new Date(validationEnd).toISOString(),
        duration_seconds: (llmValidationTime / 1000).toFixed(1),
        judge_models_used: validationResult.metadata?.judge_models || [],
        execution_mode: executionMode,
        parallel_metrics: parallelMetrics,
        validator_type: isParallelValidator ? 'parallel' : 'sequential',
        parallel_enabled: isParallelValidator && parallelEnabled,
      };

      this.logger.log(` LLM-as-judge validation completed in ${(llmValidationTime / 1000).toFixed(2)}s (${executionMode} mode)`);
    } catch (error) {
      this.logger.error(` LLM-as-judge validation failed: ${error.message}`);
      this.logger.error('Stack trace:', error.stack);
      timing.phase_timings.llm_validation_seconds = '0.0';
      timing.agent_performance.llm_validation = {
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: '0.0',
        error: error.message,
        execution_mode: 'error',
        validator_type: this.complianceValidator instanceof ParallelExpenseComplianceUQLMValidator ? 'parallel' : 'sequential',
      };
    }
  }

  async validateComplianceResults(
    complianceResult: any,
    country: string,
    receiptType: string,
    icp: string,
    complianceData: any,
    extractedData: any,
  ): Promise<any> {
    if (!this.complianceValidator) {
      throw new Error('LLM-as-judge compliance validator not available');
    }

    this.logger.log(' Running standalone LLM-as-judge validation');

    try {
      const validationResult = await this.complianceValidator.validateComplianceResponse(
        JSON.stringify(complianceResult),
        country,
        receiptType,
        icp,
        complianceData,
        extractedData,
      );

      this.logger.log(` LLM-as-judge validation completed with confidence: ${validationResult?.overall_score || 0}`);
      return validationResult;
    } catch (error) {
      this.logger.error(' LLM-as-judge validation failed:', error);
      throw new Error(`LLM validation failed: ${error.message}`);
    }
  }
}
