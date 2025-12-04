import { Injectable, Logger } from '@nestjs/common';
import { AgentFactoryService } from './services/agent-factory.service';
import { ProcessingMetricsService } from './services/processing-metrics.service';
import { ProcessingStorageService } from './services/processing-storage.service';
import { ValidationOrchestratorService } from './services/validation-orchestrator.service';
import { StorageResolverService } from '../storage/services/storage-resolver.service';
import { type CompleteProcessingResult } from '../schemas/expense-schemas';

@Injectable()
export class ExpenseProcessingService {
  private readonly logger = new Logger(ExpenseProcessingService.name);

  constructor(
    private readonly agentFactory: AgentFactoryService,
    private readonly metricsService: ProcessingMetricsService,
    private readonly storageService: ProcessingStorageService,
    private readonly validationOrchestrator: ValidationOrchestratorService,
    private readonly storageResolver: StorageResolverService,
  ) {
    this.logger.log('ExpenseProcessingService initialized with parallel processing only');
  }

  async processExpenseDocument(
    markdownContent: string,
    filename: string,
    storageKey: string,
    country: string,
    icp: string,
    complianceData: any,
    expenseSchema: any,
    progressCallback?: (stage: string, progress: number) => void,
    markdownExtractionInfo?: { markdownExtractionTime: number; documentReader: string },
    userId?: string,
  ): Promise<CompleteProcessingResult> {
    this.logger.log(` Starting PARALLEL expense processing for: ${filename}`);
    this.logger.log(` Country: ${country}, ICP: ${icp}`);
    if (userId) {
      this.logger.log(` User: ${userId}`);
    }

    const { timing, trueStartTime } = this.metricsService.createTimingObject(markdownExtractionInfo);
    const agents = this.agentFactory.getAgents();

    // Resolve physical file path from storage key (handles both local and S3)
    const { path: physicalPath, isTemp } = await this.storageResolver.getPhysicalPath(storageKey);
    this.logger.debug(`Resolved storage key to physical path: ${physicalPath} (temp: ${isTemp})`);

    try {
      // PARALLEL GROUP 1: Independent phases that can run simultaneously
      progressCallback?.('parallelPhase1', 10);
      this.logger.log(' Starting Parallel Group 1: Image Quality + Classification + Data Extraction');

      const parallelGroup1Start = Date.now();

      const [formattedQualityAssessment, classification, extraction] = await Promise.all([
        this.runImageQualityAssessment(physicalPath, timing, agents.imageQualityAssessmentAgent),
        this.runFileClassification(markdownContent, country, expenseSchema, timing, agents.fileClassificationAgent),
        this.runDataExtraction(markdownContent, complianceData, timing, agents.dataExtractionAgent),
      ]);

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
        complianceData,
        extraction,
        timing,
        agents.issueDetectionAgent,
      );

      const citations = {};
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
      await this.validationOrchestrator.validateCompliance(
        compliance,
        country,
        classification.expense_type || 'unknown',
        icp,
        complianceData,
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
        citations,
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
    } catch (error) {
      this.logger.error(` PARALLEL expense processing failed for ${filename}:`, error);
      throw new Error(`Parallel expense processing failed: ${error.message}`);
    } finally {
      // Cleanup temp file if it was downloaded from S3
      if (isTemp) {
        this.storageResolver.cleanupTempFile(physicalPath);
      }
    }
  }

  private async runImageQualityAssessment(imagePath: string, timing: any, agent: any) {
    const start = Date.now();
    this.logger.log(' Phase 0: Image Quality Assessment (parallel)');

    const result = await agent.assessImageQuality(imagePath);
    const formattedResult = agent.formatAssessmentForWorkflow(result, imagePath);

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

  private async runDataExtraction(markdownContent: string, complianceData: any, timing: any, agent: any) {
    const start = Date.now();
    this.logger.log(' Phase 2: Data Extraction (parallel)');

    const result = await agent.extractData(markdownContent, complianceData);

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
    complianceData: any,
    extractedData: any,
    timing: any,
    agent: any,
  ) {
    const start = Date.now();
    this.logger.log('️ Phase 3: Issue Detection (parallel)');

    const result = await agent.analyzeCompliance(country, receiptType, icp, complianceData, extractedData);

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
    complianceData: any,
    extractedData: any,
    filename?: string,
  ): Promise<any> {
    const validationResult = await this.validationOrchestrator.validateComplianceResults(
      complianceResult,
      country,
      receiptType,
      icp,
      complianceData,
      extractedData,
    );

    if (filename) {
      await this.storageService.saveValidationResults(filename, validationResult);
    }

    return validationResult;
  }
}
