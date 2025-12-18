import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { ExpenseDocument } from './expense-document.entity';

export enum ReferenceType {
  CONTENT_DUPLICATE = 'CONTENT_DUPLICATE',
  USER_REFERENCE = 'USER_REFERENCE',
  METADATA_SIMILAR = 'METADATA_SIMILAR',
}

export enum DetectionMethod {
  SHA256_HASH = 'SHA256_HASH',
  METADATA_MATCH = 'METADATA_MATCH',
  USER_CHOICE = 'USER_CHOICE',
}

@Entity('document_references')
@Unique('unique_document_reference', ['sourceDocumentId', 'targetDocumentId'])
export class DocumentReference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'source_document_id' })
  sourceDocumentId: string;

  @Column({ name: 'target_document_id' })
  targetDocumentId: string;

  @Column({ name: 'reference_type', type: 'enum', enum: ReferenceType })
  referenceType: ReferenceType;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  confidence: number; // Duplicate detection confidence (0.0-1.0)

  @Column({ name: 'detection_method', type: 'enum', enum: DetectionMethod })
  detectionMethod: DetectionMethod;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string; // User who made the reference

  // Relationships
  @ManyToOne(() => ExpenseDocument, (document) => document.sourceReferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_document_id' })
  sourceDocument: ExpenseDocument;

  @ManyToOne(() => ExpenseDocument, (document) => document.targetReferences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_document_id' })
  targetDocument: ExpenseDocument;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
