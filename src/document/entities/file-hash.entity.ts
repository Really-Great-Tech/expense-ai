import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ExpenseDocument } from './expense-document.entity';

@Entity('file_hashes')
export class FileHash {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 64 })
  hash: string; // SHA-256 content hash

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'upload_count', type: 'int', default: 1 })
  uploadCount: number;

  @Column({ name: 'first_uploaded_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  firstUploadedAt: Date;

  @Column({ name: 'last_uploaded_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastUploadedAt: Date;

  // Relationships
  @ManyToOne(() => ExpenseDocument, (document) => document.fileHashes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: ExpenseDocument;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
