import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptProcessingResultRepository } from '../repositories/receipt-processing-result.repository';
import { ProcessingStatus, ReceiptProcessingResult } from '../entities/receipt-processing-result.entity';
import { ExpenseDocument, DocumentStatus } from '../entities/expense-document.entity';
import { Receipt } from '../entities/receipt.entity';

export enum OverallExpenseStatus {
  /** Document upload and splitting in progress */
  SPLITTING = 'SPLITTING',
  /** Splitting complete, receipts queued or being processed */
  PROCESSING_RECEIPTS = 'PROCESSING_RECEIPTS',
  /** All receipts completed successfully */
  COMPLETED = 'COMPLETED',
  /** Some receipts failed, but no active processing */
  PARTIALLY_COMPLETE = 'PARTIALLY_COMPLETE',
  /** Document splitting failed */
  FAILED = 'FAILED',
}

@Injectable()
export class ReceiptResultsQueryService {
  private readonly logger = new Logger(ReceiptResultsQueryService.name);

  constructor(
    private receiptProcessingResultRepo: ReceiptProcessingResultRepository,
    @InjectRepository(Receipt)
    private receiptRepo: Repository<Receipt>,
    @InjectRepository(ExpenseDocument)
    private expenseDocumentRepo: Repository<ExpenseDocument>,
  ) {}

  async getReceiptResults(receiptId: string): Promise<any> {
    const result = await this.receiptProcessingResultRepo.findByReceiptId(receiptId);

    if (!result) {
      throw new NotFoundException(`No processing results found for receipt ${receiptId}`);
    }

    return {
      receiptId: result.receiptId,
      sourceDocumentId: result.sourceDocumentId,
      processingJobId: result.processingJobId,
      status: result.status,

      results: {
        classification: result.classificationResult,
        extraction: result.extractedData,
        compliance: result.complianceValidation,
        qualityAssessment: result.qualityAssessment,
        citations: result.citationData,
      },

      metadata: result.processingMetadata,
      fileReferences: result.fileReferences,

      processingStartedAt: result.processingStartedAt,
      processingCompletedAt: result.processingCompletedAt,
      error: result.errorMessage
        ? {
            message: result.errorMessage,
            stack: result.errorStack,
          }
        : undefined,
    };
  }

  async getReceiptStatus(receiptId: string): Promise<any> {
    const result = await this.receiptProcessingResultRepo.findByReceiptId(receiptId);

    if (!result) {
      throw new NotFoundException(`No processing status found for receipt ${receiptId}`);
    }

    return {
      receiptId: result.receiptId,
      status: result.status,
      progress: this.calculateProgress(result.status),
      processingStartedAt: result.processingStartedAt,
      processingCompletedAt: result.processingCompletedAt,
      error: result.errorMessage
        ? {
            message: result.errorMessage,
          }
        : undefined,
    };
  }

  async getDocumentResults(documentId: string): Promise<any> {
    const document = await this.expenseDocumentRepo.findOne({
      where: { id: documentId }
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const receipts = await this.receiptRepo.find({
      where: { sourceDocumentId: documentId }
    });
    const results = await this.receiptProcessingResultRepo.findByDocumentId(documentId);

    // Calculate overall status
    const overallStatus = this.deriveOverallStatus(document, receipts, results);

    return {
      document: {
        id: document.id,
        originalFileName: document.originalFileName,
        status: document.status,
        totalReceipts: receipts.length,
        country: document.country,
        icp: document.icp,
        uploadedBy: document.uploadedBy,
        createdAt: document.createdAt,
      },
      overallStatus,
      receipts: receipts.map((receipt) => {
        const result = results.find((r) => r.receiptId === receipt.id);

        // Build compliance-style results if processing is completed
        let complianceResults = null;
        if (result && result.status === ProcessingStatus.COMPLETED) {
          // Extract image quality issues
          const imageQualityIssues = this.extractImageQualityIssues(result.qualityAssessment);

          // Merge all issues
          const mergedIssues = this.mergeComplianceIssues(
            result.complianceValidation?.validation_result?.issues || [],
            imageQualityIssues
          );

          complianceResults = {
            extraction: result.extractedData || {},
            meta: {
              receiptId: result.receiptId,
              sourceDocumentId: result.sourceDocumentId,
              processingCompletedAt: result.processingCompletedAt,
              processingTime: result.processingMetadata?.processingTime,
              processed_at: result.processingMetadata?.processedAt,
            },
            issues: mergedIssues,
          };
        }

        return {
          receiptId: receipt.id,
          fileName: receipt.fileName,
          fileSize: receipt.fileSize,
          storageKey: receipt.storageKey,
          status: receipt.status,
          processingStatus: result?.status,
          processingProgress: result ? this.calculateProgress(result.status) : 0,
          processingCompletedAt: result?.processingCompletedAt,
          hasResults: !!result && result.status === ProcessingStatus.COMPLETED,
          hasErrors: !!result?.errorMessage,
          results: complianceResults,
        };
      }),
      overallProgress: this.calculateOverallProgress(results),
      stats: {
        total: receipts.length,
        completed: results.filter((r) => r.status === ProcessingStatus.COMPLETED).length,
        failed: results.filter((r) => r.status === ProcessingStatus.FAILED).length,
        processing: results.filter(
          (r) =>
            r.status !== ProcessingStatus.COMPLETED &&
            r.status !== ProcessingStatus.FAILED &&
            r.status !== ProcessingStatus.QUEUED,
        ).length,
        queued: results.filter((r) => r.status === ProcessingStatus.QUEUED).length,
      },
    };
  }

  async queryResults(filters: {
    documentId?: string;
    status?: ProcessingStatus;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ results: ReceiptProcessingResult[]; total: number }> {
    const queryBuilder = this.receiptProcessingResultRepo.repository.createQueryBuilder('result');

    if (filters.documentId) {
      queryBuilder.andWhere('result.sourceDocumentId = :documentId', {
        documentId: filters.documentId,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('result.status = :status', { status: filters.status });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('result.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('result.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    const total = await queryBuilder.getCount();

    const results = await queryBuilder
      .orderBy('result.createdAt', 'DESC')
      .skip(filters.offset || 0)
      .take(filters.limit || 20)
      .getMany();

    return { results, total };
  }

  async getProcessingMetrics(documentId?: string): Promise<any> {
    const stats = await this.receiptProcessingResultRepo.getProcessingStats(documentId);

    return {
      timestamp: new Date().toISOString(),
      documentId: documentId || 'all',
      metrics: {
        totalReceipts: stats.total,
        queuedReceipts: stats.queued,
        processingReceipts: stats.processing,
        completedReceipts: stats.completed,
        failedReceipts: stats.failed,
        averageProcessingTimeSeconds: stats.averageProcessingTime,
        successRate:
          stats.total > 0 ? Math.round((stats.completed / (stats.completed + stats.failed)) * 100) : 0,
      },
    };
  }

  private calculateProgress(status: ProcessingStatus): number {
    const progressMap: Record<ProcessingStatus, number> = {
      [ProcessingStatus.QUEUED]: 0,
      [ProcessingStatus.PROCESSING]: 10,
      [ProcessingStatus.CLASSIFICATION]: 20,
      [ProcessingStatus.EXTRACTION]: 40,
      [ProcessingStatus.VALIDATION]: 60,
      [ProcessingStatus.QUALITY_ASSESSMENT]: 80,
      [ProcessingStatus.CITATION_GENERATION]: 90,
      [ProcessingStatus.COMPLETED]: 100,
      [ProcessingStatus.FAILED]: 0,
      [ProcessingStatus.RETRYING]: 5,
    };
    return progressMap[status] || 0;
  }

  private calculateOverallProgress(results: ReceiptProcessingResult[]): number {
    if (results.length === 0) return 0;

    const totalProgress = results.reduce((sum, result) => {
      return sum + this.calculateProgress(result.status);
    }, 0);

    return Math.round(totalProgress / results.length);
  }

  /**
   * Get compliance-focused results for a receipt
   * Returns only extraction, meta (metadata), and issues
   * Merges image quality issues into the compliance issues list for unified display
   */
  async getReceiptComplianceResults(receiptId: string): Promise<any> {
    const result = await this.receiptProcessingResultRepo.findByReceiptId(receiptId);

    if (!result) {
      throw new NotFoundException(`No processing results found for receipt ${receiptId}`);
    }

    // Check if processing is complete
    if (result.status !== ProcessingStatus.COMPLETED) {
      throw new NotFoundException(`Receipt ${receiptId} processing is not completed yet (status: ${result.status})`);
    }

    // Extract image quality issues and convert to compliance issue format
    const imageQualityIssues = this.extractImageQualityIssues(result.qualityAssessment);

    // Merge image quality issues with compliance issues
    const mergedIssues = this.mergeComplianceIssues(
      result.complianceValidation?.validation_result?.issues || [],
      imageQualityIssues
    );

    // Build compliance-focused response with only extraction, meta, and issues
    return {
      // Extracted data
      extraction: result.extractedData || {},

      // Metadata
      meta: {
        receiptId: result.receiptId,
        sourceDocumentId: result.sourceDocumentId,
        processingCompletedAt: result.processingCompletedAt,
        processingTime: result.processingMetadata?.processingTime,
        processed_at: result.processingMetadata?.processedAt,
      },

      // All issues (compliance + image quality)
      issues: mergedIssues,
    };
  }

  /**
   * Extract image quality issues from quality assessment
   * Converts quality problems into compliance issue format
   */
  private extractImageQualityIssues(qualityAssessment: any): Array<any> {
    if (!qualityAssessment) return [];

    const issues: Array<any> = [];

    // Check blur detection
    if (qualityAssessment.blur_detection?.detected) {
      issues.push({
        issue_type: 'Image related | Blur Detection',
        field: 'image_quality',
        description: qualityAssessment.blur_detection.description || 'Document shows blur affecting readability',
        recommendation: qualityAssessment.blur_detection.recommendation || 'Rescan document with better focus',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.blur_detection.severity_level || 'medium',
        confidence: qualityAssessment.blur_detection.confidence_score || 0.5,
      });
    }

    // Check glare
    if (qualityAssessment.glare_identification?.detected) {
      issues.push({
        issue_type: 'Image related | Glare Detection',
        field: 'image_quality',
        description: qualityAssessment.glare_identification.description || 'Document has glare affecting visibility',
        recommendation: qualityAssessment.glare_identification.recommendation || 'Rescan without glare or reflection',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.glare_identification.severity_level || 'medium',
        confidence: qualityAssessment.glare_identification.confidence_score || 0.5,
      });
    }

    // Check water stains
    if (qualityAssessment.water_stains?.detected) {
      issues.push({
        issue_type: 'Image related | Water Damage',
        field: 'image_quality',
        description: qualityAssessment.water_stains.description || 'Document shows water stains',
        recommendation: qualityAssessment.water_stains.recommendation || 'Request original or undamaged copy',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.water_stains.severity_level || 'high',
        confidence: qualityAssessment.water_stains.confidence_score || 0.5,
      });
    }

    // Check tears or folds
    if (qualityAssessment.tears_or_folds?.detected) {
      issues.push({
        issue_type: 'Image related | Physical Damage',
        field: 'image_quality',
        description: qualityAssessment.tears_or_folds.description || 'Document has tears or folds',
        recommendation: qualityAssessment.tears_or_folds.recommendation || 'Request undamaged copy or flatten document',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.tears_or_folds.severity_level || 'medium',
        confidence: qualityAssessment.tears_or_folds.confidence_score || 0.5,
      });
    }

    // Check cut-off sections
    if (qualityAssessment.cut_off_detection?.detected) {
      issues.push({
        issue_type: 'Image related | Incomplete Scan',
        field: 'image_quality',
        description: qualityAssessment.cut_off_detection.description || 'Parts of document are cut off',
        recommendation: qualityAssessment.cut_off_detection.recommendation || 'Rescan complete document',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.cut_off_detection.severity_level || 'high',
        confidence: qualityAssessment.cut_off_detection.confidence_score || 0.5,
      });
    }

    // Check missing sections
    if (qualityAssessment.missing_sections?.detected) {
      issues.push({
        issue_type: 'Image related | Missing Content',
        field: 'image_quality',
        description: qualityAssessment.missing_sections.description || 'Document appears incomplete',
        recommendation: qualityAssessment.missing_sections.recommendation || 'Provide complete document',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.missing_sections.severity_level || 'high',
        confidence: qualityAssessment.missing_sections.confidence_score || 0.5,
      });
    }

    // Check obstructions
    if (qualityAssessment.obstructions?.detected) {
      issues.push({
        issue_type: 'Image related | Obstruction',
        field: 'image_quality',
        description: qualityAssessment.obstructions.description || 'Document has obstructions covering content',
        recommendation: qualityAssessment.obstructions.recommendation || 'Remove obstructions and rescan',
        knowledge_base_reference: 'Image Quality Standards',
        severity: qualityAssessment.obstructions.severity_level || 'high',
        confidence: qualityAssessment.obstructions.confidence_score || 0.5,
      });
    }

    return issues;
  }

  /**
   * Merge compliance issues with image quality issues
   * Adds index numbers to all issues for consistent display
   */
  private mergeComplianceIssues(complianceIssues: Array<any>, imageQualityIssues: Array<any>): Array<any> {
    const allIssues = [...complianceIssues, ...imageQualityIssues];

    // Add index to each issue for easy reference
    return allIssues.map((issue, index) => ({
      index: index + 1,
      ...issue,
    }));
  }

  /**
   * Derive overall status from document and child receipt states
   * Logic: If no child is actively processing, consider master complete/failed
   */
  private deriveOverallStatus(
    document: ExpenseDocument,
    receipts: Receipt[],
    processingResults: ReceiptProcessingResult[],
  ): OverallExpenseStatus {
    // If document splitting failed
    if (document.status === DocumentStatus.FAILED) {
      return OverallExpenseStatus.FAILED;
    }

    // If document is still splitting (not yet completed)
    if (document.status !== DocumentStatus.COMPLETED) {
      return OverallExpenseStatus.SPLITTING;
    }

    // If no receipts created yet (shouldn't happen, but handle gracefully)
    if (receipts.length === 0) {
      return OverallExpenseStatus.SPLITTING;
    }

    // Check if any receipt is actively processing
    const hasActiveProcessing = processingResults.some((result) =>
      this.isActiveProcessingStatus(result.status),
    );

    // Count completed and failed
    const completedCount = processingResults.filter(
      (r) => r.status === ProcessingStatus.COMPLETED,
    ).length;
    const failedCount = processingResults.filter(
      (r) => r.status === ProcessingStatus.FAILED,
    ).length;

    // If there are active processing jobs, status is PROCESSING_RECEIPTS
    if (hasActiveProcessing) {
      return OverallExpenseStatus.PROCESSING_RECEIPTS;
    }

    // No active processing - determine final state
    // All completed successfully
    if (completedCount === receipts.length) {
      return OverallExpenseStatus.COMPLETED;
    }

    // All failed
    if (failedCount === receipts.length) {
      return OverallExpenseStatus.FAILED;
    }

    // Some succeeded, some failed, none processing
    if (completedCount > 0 && failedCount > 0) {
      return OverallExpenseStatus.PARTIALLY_COMPLETE;
    }

    // Some receipts haven't been processed yet (no results), but none are actively processing
    // This could happen if jobs were cancelled or never started
    if (processingResults.length < receipts.length) {
      // If some are complete, consider it partially complete
      if (completedCount > 0) {
        return OverallExpenseStatus.PARTIALLY_COMPLETE;
      }
      // Nothing completed and nothing processing = consider it partially complete (cancelled/stopped)
      return OverallExpenseStatus.PARTIALLY_COMPLETE;
    }

    // Default fallback
    return OverallExpenseStatus.PROCESSING_RECEIPTS;
  }

  /**
   * Check if a processing status represents active processing
   */
  private isActiveProcessingStatus(status: ProcessingStatus): boolean {
    return [
      ProcessingStatus.QUEUED,
      ProcessingStatus.PROCESSING,
      ProcessingStatus.CLASSIFICATION,
      ProcessingStatus.EXTRACTION,
      ProcessingStatus.VALIDATION,
      ProcessingStatus.QUALITY_ASSESSMENT,
      ProcessingStatus.CITATION_GENERATION,
      ProcessingStatus.RETRYING,
    ].includes(status);
  }
}
