import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ExpenseSubmitDto, parseS3Path } from './dto/expense-submit.dto';
import { QUEUE_NAMES, JOB_NAMES } from '@/common/constants/queue.constants';
import { SplitExpenseJobData } from '@/workflow/interfaces/workflow-job-data.interface';
import { ExpenseDocument, DocumentStatus } from '@/expense-document/entities/expense-document.entity';
import { JobRecordRepository } from '@/workflow/repositories/job-record.repository';
import { ConfigService } from '@nestjs/config';

export interface ProcessMessageResult {
  success: boolean;
  duplicate: boolean;
  documentId?: string;
  jobId?: string;
  error?: string;
}

/** Default document reader when not specified */
const DEFAULT_DOCUMENT_READER = 'textract';

/** Default MIME type for documents */
const DEFAULT_MIME_TYPE = 'application/pdf';

/**
 * IngestService - S3-based document ingestion for expense processing
 *
 * This service accepts S3 file references and enqueues SPLIT_EXPENSE jobs.
 * It is the programmatic entry point for document processing (no HTTP API).
 *
 * ## Overview
 *
 * Unlike the HTTP upload endpoint which receives file buffers, this service
 * accepts references to files already stored in S3. This enables integration
 * with external systems like RabbitMQ consumers, scheduled jobs, or other services.
 *
 * ## Input Payload
 *
 * ```typescript
 * interface ExpenseSubmitDto {
 *   fileId: string;      // Unique ID for idempotency (prevents duplicate processing)
 *   fileName: string;    // Original file name (e.g., "expense_receipt.pdf")
 *   filePath: string;    // Full S3 URI (e.g., "s3://bucket-name/path/to/file.pdf")
 *   customerId: number;  // Customer identifier for tracking
 *   icp: string;         // ICP code (e.g., "global people", "DEFAULT")
 *   country: string;     // Country code (e.g., "UK", "US", "DE")
 * }
 * ```
 *
 * ## Response
 *
 * ```typescript
 * interface ProcessMessageResult {
 *   success: boolean;    // Whether the operation completed without errors
 *   duplicate: boolean;  // True if fileId was already processed
 *   documentId?: string; // UUID of created/existing ExpenseDocument
 *   jobId?: string;      // BullMQ job ID (only for new documents)
 *   error?: string;      // Error message if success is false
 * }
 * ```
 *
 * ## Usage Examples
 *
 * ### Basic Usage
 * ```typescript
 * @Injectable()
 * export class MyConsumer {
 *   constructor(private readonly ingestService: IngestService) {}
 *
 *   async handleMessage(payload: ExpenseSubmitDto) {
 *     const result = await this.ingestService.processMessage(payload);
 *
 *     if (result.success && !result.duplicate) {
 *       console.log(`Processing started: document=${result.documentId}, job=${result.jobId}`);
 *     } else if (result.duplicate) {
 *       console.log(`Already processed: document=${result.documentId}`);
 *     } else {
 *       console.error(`Failed: ${result.error}`);
 *     }
 *   }
 * }
 * ```
 *
 * ### RabbitMQ Consumer Example
 * ```typescript
 * @Injectable()
 * export class ExpenseConsumer {
 *   constructor(private readonly ingestService: IngestService) {}
 *
 *   @RabbitSubscribe({ queue: 'expense-files' })
 *   async onMessage(msg: {
 *     fileId: string;
 *     fileName: string;
 *     filePath: string;
 *     customerId: number;
 *     icp: string;
 *     country: string;
 *   }) {
 *     const result = await this.ingestService.processMessage(msg);
 *
 *     if (!result.success) {
 *       throw new Error(result.error); // Triggers requeue
 *     }
 *   }
 * }
 * ```
 *
 * ### Cron Job Example
 * ```typescript
 * @Injectable()
 * export class ScheduledIngest {
 *   constructor(
 *     private readonly ingestService: IngestService,
 *     private readonly s3Service: S3StorageService,
 *   ) {}
 *
 *   @Cron('0 * * * *') // Every hour
 *   async processNewFiles() {
 *     const files = await this.s3Service.listFiles('incoming/');
 *
 *     for (const file of files) {
 *       await this.ingestService.processMessage({
 *         fileId: file.key, // Use S3 key as idempotency key
 *         fileName: path.basename(file.key),
 *         filePath: `s3://my-bucket/${file.key}`,
 *         customerId: 12345,
 *         icp: 'DEFAULT',
 *         country: 'US',
 *       });
 *     }
 *   }
 * }
 * ```
 *
 * ## Processing Flow
 *
 * ```
 * processMessage(dto)
 *       │
 *       ├── 1. Parse S3 URI → bucket + key
 *       │
 *       ├── 2. Check duplicate (fileId → idempotencyKey)
 *       │      └── If exists: return { duplicate: true, documentId }
 *       │
 *       ├── 3. Create ExpenseDocument record (status: UPLOADED)
 *       │
 *       ├── 4. Enqueue SPLIT_EXPENSE job to BullMQ
 *       │
 *       ├── 5. Create JobRecord for audit trail
 *       │
 *       └── 6. Return { success: true, documentId, jobId }
 * ```
 *
 * ## Defaults Applied
 *
 * - `documentReader`: 'textract' (AWS Textract for OCR)
 * - `mimeType`: 'application/pdf'
 * - `userId`: 'customer-{customerId}'
 *
 * ## Cross-Bucket Support
 *
 * The service supports downloading files from any S3 bucket, not just the
 * configured default bucket. The bucket is extracted from the `filePath` URI.
 *
 * ## Idempotency
 *
 * The `fileId` field is used as an idempotency key. If a document with the
 * same `fileId` already exists, the service returns the existing document ID
 * with `duplicate: true` instead of creating a new record.
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly defaultAttempts: number;
  private readonly backoffDelayMs: number;

  constructor(
    @InjectQueue(QUEUE_NAMES.EXPENSE_WORKFLOW)
    private readonly workflowQueue: Queue,
    @InjectRepository(ExpenseDocument)
    private readonly expenseDocumentRepo: Repository<ExpenseDocument>,
    private readonly jobRecordRepository: JobRecordRepository,
    private readonly configService: ConfigService,
  ) {
    this.defaultAttempts = this.configService.get<number>('WORKER_MAX_RETRY_ATTEMPTS', 4);
    this.backoffDelayMs = this.configService.get<number>('WORKER_BACKOFF_DELAY_MS', 35000);
  }

  /**
   * Process an expense document from S3.
   * Creates ExpenseDocument record, enqueues SPLIT_EXPENSE job, and returns immediately.
   *
   * @param dto - S3 file reference and metadata
   * @returns ProcessMessageResult with documentId and jobId on success
   */
  async processMessage(dto: ExpenseSubmitDto): Promise<ProcessMessageResult> {
    const { fileId, fileName, filePath, customerId, icp, country } = dto;

    this.logger.log('Processing ingest message', { fileId });

    try {
      // Parse S3 path into bucket and key
      const s3Location = parseS3Path(filePath);
      const { bucket: s3Bucket, key: s3Key } = s3Location;

      this.logger.debug('Parsed S3 location', { s3Bucket, s3Key });

      // Step 1: Check for duplicate using fileId as idempotency key
      const existingDocument = await this.expenseDocumentRepo.findOne({
        where: { idempotencyKey: fileId },
      });

      if (existingDocument) {
        this.logger.log('Duplicate file detected, skipping', { fileId, documentId: existingDocument.id });
        return {
          success: true,
          duplicate: true,
          documentId: existingDocument.id,
        };
      }

      // Step 2: Create ExpenseDocument record
      const correlationId = uuidv4();
      const userId = `customer-${customerId}`;

      const document = this.expenseDocumentRepo.create({
        storageBucket: s3Bucket,
        storageKey: s3Key,
        storageType: 's3',
        originalFileName: fileName,
        fileSize: 0, // Will be populated during processing
        mimeType: DEFAULT_MIME_TYPE,
        idempotencyKey: fileId,
        uploadedBy: userId,
        country,
        icp,
        status: DocumentStatus.UPLOADED,
        processingMetadata: {
          correlationId,
          fileId,
          customerId,
          ingestSource: 's3',
          originalFilePath: filePath,
        },
      });

      const savedDocument = await this.expenseDocumentRepo.save(document);
      const documentId = savedDocument.id;

      // Step 3: Create BullMQ job
      const jobData: SplitExpenseJobData = {
        documentId,
        storageKey: s3Key,
        storageBucket: s3Bucket,
        storageType: 's3',
        originalFileName: fileName,
        fileSize: 0,
        mimeType: DEFAULT_MIME_TYPE,
        userId,
        country,
        icp,
        documentReader: DEFAULT_DOCUMENT_READER,
      };

      const job = await this.workflowQueue.add(JOB_NAMES.SPLIT_EXPENSE, jobData, {
        jobId: `split-${documentId}`,
        attempts: this.defaultAttempts,
        backoff: { type: 'exponential', delay: this.backoffDelayMs },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      });

      // Step 4: Create job record for audit trail
      try {
        await this.jobRecordRepository.create({
          bullmqJobId: job.id!,
          type: 'split-expense',
          documentId,
          maxAttempts: this.defaultAttempts,
          metadata: { correlationId, fileId, customerId },
        });
      } catch (recordError) {
        const error = recordError as Error;
        this.logger.warn('Failed to create job record (non-fatal)', { error: error.message, documentId });
        // Non-fatal - continue even if audit record fails
      }

      this.logger.log('Created workflow job', { jobId: job.id, documentId, correlationId });

      return {
        success: true,
        duplicate: false,
        documentId,
        jobId: job.id,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to process ingest message', {
        error: err.message,
        fileId,
        stack: err.stack,
      });
      return {
        success: false,
        duplicate: false,
        error: err.message,
      };
    }
  }
}
