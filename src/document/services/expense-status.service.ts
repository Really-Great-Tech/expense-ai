import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseDocument, DocumentStatus } from '../entities/expense-document.entity';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { ReceiptProcessingResult, ProcessingStatus } from '../entities/receipt-processing-result.entity';

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

export interface ExpenseStatusResponse {
  expenseDocumentId: string;
  originalFileName: string;

  /** Document-level status (splitting pipeline) */
  documentStatus: DocumentStatus;

  /** Overall derived status from child receipts */
  overallStatus: OverallExpenseStatus;

  /** Progress metrics */
  progress: {
    /** Document splitting progress (0-100) */
    uploadProgress: number;
    /** Child receipts processing progress (0-100) */
    processingProgress: number;
    /** Combined overall progress (0-100) */
    overallProgress: number;
  };

  /** Child receipts breakdown */
  receipts: {
    total: number;
    created: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };

  /** Timestamps */
  timestamps: {
    uploadedAt: Date;
    splittingCompletedAt?: Date;
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
  };

  /** Metadata */
  metadata: {
    country: string;
    icp: string;
    uploadedBy: string;
    totalPages: number;
    totalReceipts: number;
  };
}

@Injectable()
export class ExpenseStatusService {
  private readonly logger = new Logger(ExpenseStatusService.name);

  constructor(
    @InjectRepository(ExpenseDocument)
    private expenseDocumentRepo: Repository<ExpenseDocument>,
    @InjectRepository(Receipt)
    private receiptRepo: Repository<Receipt>,
    @InjectRepository(ReceiptProcessingResult)
    private receiptProcessingResultRepo: Repository<ReceiptProcessingResult>,
  ) {}

  /**
   * Get comprehensive status for an expense document
   * Derives overall status from child receipts without persisting it
   */
  async getExpenseStatus(documentId: string): Promise<ExpenseStatusResponse> {
    // Fetch expense document
    const document = await this.expenseDocumentRepo.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Expense document ${documentId} not found`);
    }

    // Fetch child receipts
    const receipts = await this.receiptRepo.find({
      where: { sourceDocumentId: documentId },
    });

    // Fetch processing results for receipts
    const processingResults = await this.receiptProcessingResultRepo.find({
      where: { sourceDocumentId: documentId },
    });

    // Derive status from children
    const overallStatus = this.deriveOverallStatus(document, receipts, processingResults);
    const receiptBreakdown = this.calculateReceiptBreakdown(receipts, processingResults);
    const progress = this.calculateProgress(document, receipts, processingResults);
    const timestamps = this.extractTimestamps(document, processingResults);

    return {
      expenseDocumentId: document.id,
      originalFileName: document.originalFileName,
      documentStatus: document.status,
      overallStatus,
      progress,
      receipts: receiptBreakdown,
      timestamps,
      metadata: {
        country: document.country,
        icp: document.icp,
        uploadedBy: document.uploadedBy,
        totalPages: document.totalPages,
        totalReceipts: document.totalReceipts,
      },
    };
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
      // Nothing completed and nothing processing = consider it complete (cancelled/stopped)
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

  /**
   * Calculate receipt status breakdown
   */
  private calculateReceiptBreakdown(
    receipts: Receipt[],
    processingResults: ReceiptProcessingResult[],
  ) {
    const breakdown = {
      total: receipts.length,
      created: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    // Count by processing result status
    processingResults.forEach((result) => {
      if (result.status === ProcessingStatus.COMPLETED) {
        breakdown.completed++;
      } else if (result.status === ProcessingStatus.FAILED) {
        breakdown.failed++;
      } else if (result.status === ProcessingStatus.QUEUED) {
        breakdown.queued++;
      } else if (this.isActiveProcessingStatus(result.status)) {
        breakdown.processing++;
      }
    });

    // Receipts without processing results are considered "created"
    breakdown.created = receipts.length - processingResults.length;

    return breakdown;
  }

  /**
   * Calculate progress percentages
   */
  private calculateProgress(
    document: ExpenseDocument,
    receipts: Receipt[],
    processingResults: ReceiptProcessingResult[],
  ) {
    // Upload/splitting progress based on document status
    const uploadProgress = this.getDocumentStatusProgress(document.status);

    // Processing progress based on child receipt completion
    let processingProgress = 0;
    if (receipts.length > 0 && processingResults.length > 0) {
      const totalProgress = processingResults.reduce((sum, result) => {
        return sum + this.getProcessingStatusProgress(result.status);
      }, 0);
      processingProgress = Math.round(totalProgress / receipts.length);
    }

    // Overall progress: weighted average (30% upload, 70% processing)
    const overallProgress = Math.round(uploadProgress * 0.3 + processingProgress * 0.7);

    return {
      uploadProgress,
      processingProgress,
      overallProgress,
    };
  }

  /**
   * Map document status to progress percentage
   */
  private getDocumentStatusProgress(status: DocumentStatus): number {
    const progressMap: Record<DocumentStatus, number> = {
      [DocumentStatus.UPLOADED]: 10,
      [DocumentStatus.VALIDATION_COMPLETE]: 20,
      [DocumentStatus.S3_STORED]: 30,
      [DocumentStatus.PROCESSING]: 40,
      [DocumentStatus.TEXTRACT_COMPLETE]: 60,
      [DocumentStatus.BOUNDARY_DETECTION]: 80,
      [DocumentStatus.SPLITTING]: 90,
      [DocumentStatus.COMPLETED]: 100,
      [DocumentStatus.FAILED]: 0,
    };
    return progressMap[status] || 0;
  }

  /**
   * Map processing status to progress percentage
   */
  private getProcessingStatusProgress(status: ProcessingStatus): number {
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

  /**
   * Extract relevant timestamps
   */
  private extractTimestamps(
    document: ExpenseDocument,
    processingResults: ReceiptProcessingResult[],
  ) {
    const timestamps: any = {
      uploadedAt: document.createdAt,
    };

    // Splitting completed when document status changed to COMPLETED
    if (document.status === DocumentStatus.COMPLETED) {
      timestamps.splittingCompletedAt = document.updatedAt;
    }

    // Processing started when first receipt started processing
    const firstStarted = processingResults
      .filter((r) => r.processingStartedAt)
      .sort((a, b) => a.processingStartedAt!.getTime() - b.processingStartedAt!.getTime())[0];
    if (firstStarted) {
      timestamps.processingStartedAt = firstStarted.processingStartedAt;
    }

    // Processing completed when all receipts finished (either completed or failed)
    const allFinished = processingResults.every(
      (r) => r.status === ProcessingStatus.COMPLETED || r.status === ProcessingStatus.FAILED,
    );
    if (allFinished && processingResults.length > 0) {
      const lastCompleted = processingResults
        .filter((r) => r.processingCompletedAt)
        .sort((a, b) => b.processingCompletedAt!.getTime() - a.processingCompletedAt!.getTime())[0];
      if (lastCompleted) {
        timestamps.processingCompletedAt = lastCompleted.processingCompletedAt;
      }
    }

    return timestamps;
  }
}
