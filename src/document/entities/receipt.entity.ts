import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ExpenseDocument } from './expense-document.entity';

export enum ReceiptStatus {
  CREATED = 'CREATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'source_document_id' })
  sourceDocumentId: string;

  @Column({ name: 'storage_key' })
  storageKey: string;

  @Column({ name: 'storage_bucket' })
  storageBucket: string;

  @Column({ name: 'storage_type', type: 'enum', enum: ['local', 's3'], default: 'local' })
  storageType: 'local' | 's3';

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'storage_url', nullable: true })
  storageUrl: string;

  @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.CREATED })
  status: ReceiptStatus;

  @Column({ name: 'parsed_data', type: 'json', nullable: true })
  parsedData: any;

  @Column({ name: 'extracted_text', type: 'text', nullable: true })
  extractedText: string;

  @Column({ type: 'json', nullable: true })
  metadata: {
    receiptNumber?: number;
    pageNumbers?: number[];
    totalPages?: number;
    splitConfidence?: number;
    splitReasoning?: string;
    textractConfidence?: number;
    jobId?: string;
    [key: string]: any;
  };

  // Test field for migration flow validation
  @Column({ name: 'test_migration_field', type: 'varchar', length: 255, nullable: true })
  testMigrationField: string;

  // Relationships
  @ManyToOne(() => ExpenseDocument, (document) => document.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_document_id' })
  sourceDocument: ExpenseDocument;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
