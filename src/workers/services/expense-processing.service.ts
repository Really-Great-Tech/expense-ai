import { Injectable, Logger } from '@nestjs/common';
import { AgentFactoryService } from './agent-factory.service';
import { ProcessingMetricsService } from './processing-metrics.service';
import { ProcessingStorageService } from './processing-storage.service';
import { ValidationOrchestratorService } from './validation-orchestrator.service';
import { S3StorageService } from '@/storage/s3-storage.service';
import { type CompleteProcessingResult } from '@/common/schemas/expense-schemas';
import { ServiceUnavailableError } from '@/common/errors/service-errors';

@Injectable()
export class ExpenseProcessingService {
  private readonly logger = new Logger(ExpenseProcessingService.name);

  constructor(
    private readonly agentFactory: AgentFactoryService,
    private readonly metricsService: ProcessingMetricsService,
    private readonly storageService: ProcessingStorageService,
    private readonly validationOrchestrator: ValidationOrchestratorService,
    private readonly s3Storage: S3StorageService,
  ) {
    this.logger.log('ExpenseProcessingService initialized with parallel processing only');
  }

  async processExpenseDocument(
    markdownContent: string,
    filename: string,
    storageKey: string,
    country: string,
    icp: string,
    policyMarkdown: string,
    expenseSchema: any,
    progressCallback?: (stage: string, progress: number) => void,
    markdownExtractionInfo?: { markdownExtractionTime: number; documentReader: string; markdownSource?: 'stored' | 'extracted' },
    userId?: string,
  ): Promise<CompleteProcessingResult> {
    this.logger.log(` Starting PARALLEL expense processing for: ${filename}`);
    this.logger.log(` Country: ${country}, ICP: ${icp}`);
    if (userId) {
      this.logger.log(` User: ${userId}`);
    }

    const { timing, trueStartTime } = this.metricsService.createTimingObject(markdownExtractionInfo);
    const agents = this.agentFactory.getAgents();

    // Download file buffer from S3 for image quality assessment
    const fileBuffer = await this.s3Storage.downloadFile(storageKey);
    this.logger.debug(`Downloaded file from S3: ${storageKey} (${fileBuffer.length} bytes)`);

    try {
      // PARALLEL GROUP 1: Image Quality runs parallel, Classification runs first for receipt type
      progressCallback?.('parallelPhase1', 10);
      this.logger.log(' Starting Parallel Group 1: Image Quality + Classification');

      const parallelGroup1Start = Date.now();

      // Run Image Quality and Classification in parallel
      const [formattedQualityAssessment, classification] = await Promise.all([
        this.runImageQualityAssessmentFromBuffer(fileBuffer, filename, timing, agents.imageQualityAssessmentAgent),
        this.runFileClassification(markdownContent, country, expenseSchema, timing, agents.fileClassificationAgent),
      ]);

      // Get receipt type from classification
      const receiptType = classification.expense_type || 'unknown';
      this.logger.log(` Receipt type identified: ${receiptType}`);

      // Now run extraction with the receipt type
      this.logger.log(' Starting Data Extraction with receipt type context');
      const extraction = await this.runDataExtraction(markdownContent, receiptType, timing, agents.dataExtractionAgent);

      const parallelGroup1End = Date.now();
      const parallelGroup1Duration = (parallelGroup1End - parallelGroup1Start) / 1000;

      this.logger.log(` Parallel Group 1 completed in ${parallelGroup1Duration.toFixed(2)}s`);
      progressCallback?.('parallelPhase1Complete', 60);

      // PARALLEL GROUP 2: Phases that depend on extraction results
      progressCallback?.('parallelPhase2', 65);
      this.logger.log(' Starting Parallel Group 2: Issue Detection + Citation Generation');

      const parallelGroup2Start = Date.now();

      const compliance = await this.runIssueDetection(
        country,
        classification.expense_type || 'unknown',
        icp,
        policyMarkdown,
        extraction,
        timing,
        agents.issueDetectionAgent,
      );

      const citations = {}
      // const citations = await this.runCitationGeneration(
      //   extraction,
      //   markdownContent,
      //   filename,
      //   timing,
      //   agents.citationGeneratorAgent,
      // );

      const parallelGroup2End = Date.now();
      const parallelGroup2Duration = (parallelGroup2End - parallelGroup2Start) / 1000;

      this.logger.log(` Parallel Group 2 completed in ${parallelGroup2Duration.toFixed(2)}s`);
      progressCallback?.('parallelPhase2Complete', 95);

      // Phase 5: LLM-as-Judge Validation
      progressCallback?.('llmValidation', 96);
      const llmValidationResult = await this.validationOrchestrator.validateCompliance(
        compliance,
        country,
        classification.expense_type || 'unknown',
        icp,
        policyMarkdown,
        extraction,
        timing,
      );
      progressCallback?.('llmValidation', 98);

      // Finalize metrics
      this.metricsService.addParallelGroupMetrics(timing, parallelGroup1Duration, parallelGroup2Duration);
      this.metricsService.finalizeTiming(timing, trueStartTime);
      this.metricsService.validateTimingConsistency(timing, parallelGroup1Duration, parallelGroup2Duration);

      const result: CompleteProcessingResult = {
        image_quality_assessment: formattedQualityAssessment,
        classification,
        extraction,
        compliance,
        citations: llmValidationResult || citations,
        timing,
        metadata: {
          filename,
          processing_time: Date.now() - trueStartTime,
          country,
          icp,
          processed_at: new Date().toISOString(),
        },
      };

      progressCallback?.('complete', 100);
      this.logger.log(` PARALLEL expense processing finished for ${filename} in ${timing.total_processing_time_seconds}s`);

      // Save results
      await this.storageService.saveResults(filename, result);

      return result;
    } catch (error: any) {
      this.logger.error(` PARALLEL expense processing failed for ${filename}:`, error);

      // Re-throw ServiceUnavailableError to trigger job retry
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      // Wrap other retryable errors
      if (error.isRetryable || error.name === 'ServiceUnavailableError') {
        throw new ServiceUnavailableError('Processing', error, true);
      }

      throw new Error(`Parallel expense processing failed: ${error.message}`);
    }
  }

  private async runImageQualityAssessmentFromBuffer(buffer: Buffer, filename: string, timing: any, agent: any) {
    const start = Date.now();
    this.logger.log(' Phase 0: Image Quality Assessment (parallel)');

    const result = await agent.assessImageQualityFromBuffer(buffer, filename);
    const formattedResult = agent.formatAssessmentForWorkflow(result, filename);

    const end = Date.now();
    this.metricsService.recordPhase(timing, 'image_quality_assessment', start, end, {
      model_used: formattedResult.model_used,
    });

    return formattedResult;
  }

  private async runFileClassification(markdownContent: string, country: string, expenseSchema: any, timing: any, agent: any) {
    const start = Date.now();
    this.logger.log(' Phase 1: File Classification (parallel)');

    const result = await agent.classifyFile(markdownContent, country, expenseSchema);

    const end = Date.now();
    this.metricsService.recordPhase(timing, 'file_classification', start, end, {
      model_used: agent.getActualModelUsed(),
    });

    return result;
  }

  private async runDataExtraction(markdownContent: string, receiptType: string, timing: any, agent: any) {
    const start = Date.now();
    this.logger.log(' Phase 2: Data Extraction');

    const result = await agent.extractData(markdownContent, receiptType);

    const end = Date.now();
    this.metricsService.recordPhase(timing, 'data_extraction', start, end, {
      model_used: agent.getActualModelUsed(),
    });

    return result;
  }

  private async runIssueDetection(
    country: string,
    receiptType: string,
    icp: string,
    policyMarkdown: string,
    extractedData: any,
    timing: any,
    agent: any,
  ) {
    const start = Date.now();
    this.logger.log('️ Phase 3: Issue Detection (parallel)');

    const result = await agent.analyzeCompliance(country, receiptType, icp, policyMarkdown, extractedData);

    const end = Date.now();
    this.metricsService.recordPhase(timing, 'issue_detection', start, end, {
      model_used: agent.getActualModelUsed(),
    });

    return result;
  }

  private async runCitationGeneration(extractedData: any, markdownContent: string, filename: string, timing: any, agent: any) {
    const start = Date.now();
    this.logger.log(' Phase 4: Citation Generation (parallel)');

    const result = await agent.generateCitations(extractedData, markdownContent, filename);

    const end = Date.now();
    this.metricsService.recordPhase(timing, 'citation_generation', start, end, {
      model_used: agent.getActualModelUsed(),
    });

    return result;
  }

  // Standalone method for LLM validation
  async validateComplianceResults(
    complianceResult: any,
    country: string,
    receiptType: string,
    icp: string,
    policyMarkdown: string,
    extractedData: any,
    filename?: string,
  ): Promise<any> {
    const validationResult = await this.validationOrchestrator.validateComplianceResults(
      complianceResult,
      country,
      receiptType,
      icp,
      policyMarkdown,
      extractedData,
    );

    if (filename) {
      await this.storageService.saveValidationResults(filename, validationResult);
    }

    return validationResult;
  }
}