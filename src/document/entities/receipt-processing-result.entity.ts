import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Receipt } from './receipt.entity';
import { ExpenseDocument } from './expense-document.entity';

export enum ProcessingStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  CLASSIFICATION = 'CLASSIFICATION',
  EXTRACTION = 'EXTRACTION',
  VALIDATION = 'VALIDATION',
  QUALITY_ASSESSMENT = 'QUALITY_ASSESSMENT',
  CITATION_GENERATION = 'CITATION_GENERATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

@Entity('receipt_processing_results')
@Index(['receiptId', 'status'])
@Index(['sourceDocumentId', 'status'])
@Index(['processingJobId'])
export class ReceiptProcessingResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receipt_id' })
  receiptId: string;

  @Column({ name: 'source_document_id' })
  sourceDocumentId: string;

  @Column({ name: 'processing_job_id' })
  processingJobId: string;

  // Processing Results (JSON for flexibility)
  @Column({ name: 'classification_result', type: 'json', nullable: true })
  classificationResult: {
    expense_type: string;
    document_type: string;
    confidence: number;
    reasoning?: string;
  };

  @Column({ name: 'extracted_data', type: 'json', nullable: true })
  extractedData: {
    merchant_name?: string;
    merchant_address?: string;
    merchant_tax_id?: string;
    receipt_date?: string;
    receipt_time?: string;
    receipt_number?: string;
    total_amount?: number;
    currency?: string;
    tax_amount?: number;
    subtotal?: number;
    payment_method?: string;
    line_items?: any[];
    [key: string]: any;
  };

  @Column({ name: 'compliance_validation', type: 'json', nullable: true })
  complianceValidation: {
    validation_result: {
      is_valid: boolean;
      issues_count: number;
      issues: Array<{
        issue_type: string;
        description: string;
        recommendation: string;
        knowledge_base_reference: string;
      }>;
    };
  };

  @Column({ name: 'quality_assessment', type: 'json', nullable: true })
  qualityAssessment: {
    overall_quality_score: number;
    blur_detection?: any;
    contrast_assessment?: any;
    glare_identification?: any;
    water_stains?: any;
    tears_or_folds?: any;
    cut_off_detection?: any;
    missing_sections?: any;
    obstructions?: any;
    model_used?: string;
  };

  @Column({ name: 'citation_data', type: 'json', nullable: true })
  citationData: {
    citations: Array<{
      field_name: string;
      value: any;
      source_reference: string;
      confidence_score: number;
    }>;
  };

  // Processing Metadata
  @Column({ name: 'processing_metadata', type: 'json', nullable: true })
  processingMetadata: {
    processedAt?: string;
    processingTime?: number;
    agentVersions?: Record<string, string>;
    modelVersions?: Record<string, string>;
    qualityScore?: number;
    confidenceScore?: number;
    timing?: {
      image_quality_assessment?: any;
      file_classification?: any;
      data_extraction?: any;
      issue_detection?: any;
      citation_generation?: any;
      llm_validation?: any;
      total_processing_time_seconds?: number;
    };
  };

  // File References
  @Column({ name: 'file_references', type: 'json', nullable: true })
  fileReferences: {
    originalReceipt: string;
    extractedText?: string;
    auditTrail?: string;
  };

  // Status and Tracking
  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.QUEUED,
  })
  status: ProcessingStatus;

  @Column({ name: 'processing_started_at', nullable: true })
  processingStartedAt: Date;

  @Column({ name: 'processing_completed_at', nullable: true })
  processingCompletedAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  // Relationships
  @ManyToOne(() => Receipt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt;

  @ManyToOne(() => ExpenseDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_document_id' })
  sourceDocument: ExpenseDocument;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
