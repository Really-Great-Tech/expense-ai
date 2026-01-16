import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as multer from 'multer';
import * as path from 'path';

import { StorageModule } from '../storage/storage.module';
import { CountryPolicyModule } from '../country-policy/country-policy.module';
import { ExpenseResultModule } from '../expense-result/expense-result.module';
import { WorkflowModule } from '../workflow/workflow.module';

// Entities
import { ExpenseDocument } from './entities/expense-document.entity';
import { Receipt } from './entities/receipt.entity';
import { FileHash } from './entities/file-hash.entity';
import { DocumentReference } from './entities/document-reference.entity';

// Controllers
import { UploadController } from './controllers/upload.controller';
import { LoadTestController } from './controllers/load-test.controller';

// Services
import { DocumentSplitterService } from './services/document-splitter.service';
import { DocumentPersistenceService } from './services/document-persistence.service';
import { ProcessingQueueService } from './services/processing-queue.service';

// External services
import { FileValidationService } from '../utils/file-validation.service';
import { DuplicateDetectionService } from '../utils/duplicate-detection.service';

import { QUEUE_NAMES } from '../common/constants/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseDocument, Receipt, FileHash, DocumentReference]),
    StorageModule,
    CountryPolicyModule,
    ExpenseResultModule,
    forwardRef(() => WorkflowModule),

    // Register the workflow queue
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXPENSE_WORKFLOW,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 500 }, // 1 hour (reduced from 24 hours)
        removeOnFail: { age: 604800, count: 200 }, // 7 days
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),

    // Configure file upload
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: multer.diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = configService.get('UPLOAD_PATH', './uploads');
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
          },
        }),
        fileFilter: (req, file, cb) => {
          const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp'];
          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Only PDF and image files are allowed'), false);
          }
        },
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB limit
        },
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [UploadController, LoadTestController],
  providers: [
    DocumentSplitterService,
    DocumentPersistenceService,
    ProcessingQueueService,
    FileValidationService,
    DuplicateDetectionService,
  ],
  exports: [DocumentSplitterService, DocumentPersistenceService, ProcessingQueueService, TypeOrmModule],
})
export class ExpenseDocumentModule {}
