import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Country } from '../../country-policy/entities/country.entity';
import { Receipt } from './receipt.entity';
import { FileHash } from './file-hash.entity';
import { DocumentReference } from './document-reference.entity';

export enum DocumentStatus {
  UPLOADED = 'UPLOADED',
  VALIDATION_COMPLETE = 'VALIDATION_COMPLETE',
  S3_STORED = 'S3_STORED',
  PROCESSING = 'PROCESSING',
  TEXTRACT_COMPLETE = 'TEXTRACT_COMPLETE',
  BOUNDARY_DETECTION = 'BOUNDARY_DETECTION',
  SPLITTING = 'SPLITTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('expense_documents')
export class ExpenseDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_file_name' })
  originalFileName: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'storage_key', default: '' })
  storageKey: string;

  @Column({ name: 'storage_bucket', default: '' })
  storageBucket: string;

  @Column({ name: 'storage_type', type: 'enum', enum: ['local', 's3'], default: 'local' })
  storageType: 'local' | 's3';

  @Column({ name: 'storage_url', nullable: true })
  storageUrl: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.UPLOADED })
  status: DocumentStatus;

  @Column({ name: 'total_pages', type: 'int', default: 0 })
  totalPages: number;

  @Column({ name: 'total_receipts', type: 'int', default: 0 })
  totalReceipts: number;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @Column({ name: 'textract_job_id', nullable: true })
  textractJobId: string;

  @Column({ name: 'textract_result', type: 'json', nullable: true })
  textractResult: any;

  @Column({ name: 'processing_metadata', type: 'json', nullable: true })
  processingMetadata: any;

  // Required fields from factory documentation
  @Column({ name: 'idempotency_key', unique: true })
  idempotencyKey: string;

  @Column()
  country: string;

  @Column()
  icp: string;

  // Foreign key to countries table
  @Column({ name: 'country_id', nullable: true })
  countryId: number;

  // Relationships
  @ManyToOne(() => Country, { nullable: true })
  @JoinColumn({ name: 'country_id' })
  countryEntity: Country;

  @OneToMany(() => Receipt, (receipt: Receipt) => receipt.sourceDocument)
  receipts: Receipt[];

  @OneToMany(() => FileHash, (fileHash: FileHash) => fileHash.document)
  fileHashes: FileHash[];

  @OneToMany(() => DocumentReference, (docRef: DocumentReference) => docRef.sourceDocument)
  sourceReferences: DocumentReference[];

  @OneToMany(() => DocumentReference, (docRef: DocumentReference) => docRef.targetDocument)
  targetReferences: DocumentReference[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
