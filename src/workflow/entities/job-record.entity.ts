import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type JobType = 'split-expense' | 'process-receipt' | 'process-expense';
export type JobStatus = 'pending' | 'active' | 'retrying' | 'completed' | 'failed';

@Entity('job_records')
@Index('IDX_job_records_bullmq_job_id', ['bullmqJobId'], { unique: true })
@Index('IDX_job_records_document_id', ['documentId'])
@Index('IDX_job_records_receipt_id', ['receiptId'])
@Index('IDX_job_records_type_status', ['type', 'status'])
@Index('IDX_job_records_parent_job_id', ['parentJobId'])
export class JobRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'bullmq_job_id', type: 'varchar', length: 255, unique: true })
  bullmqJobId!: string;

  @Column({
    type: 'enum',
    enum: ['split-expense', 'process-receipt', 'process-expense'],
  })
  type!: JobType;

  @Column({ name: 'document_id', type: 'char', length: 36, nullable: true })
  documentId!: string | null;

  @Column({ name: 'receipt_id', type: 'char', length: 36, nullable: true })
  receiptId!: string | null;

  @Column({ name: 'parent_job_id', type: 'varchar', length: 255, nullable: true })
  parentJobId!: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'active', 'retrying', 'completed', 'failed'],
    default: 'pending',
  })
  status!: JobStatus;

  @Column({ name: 'attempts_made', type: 'int', default: 0 })
  attemptsMade!: number;

  @Column({ name: 'max_attempts', type: 'int', default: 3 })
  maxAttempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs!: number | null;
}
