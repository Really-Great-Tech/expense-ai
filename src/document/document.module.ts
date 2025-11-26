import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { ExpenseProcessor } from '../processing/processors/expense.processor';
import { ProcessingService } from '../processing/services/processing.service';
import { ExpenseProcessingService } from './processing.service';
import { AgentFactoryService } from './services/agent-factory.service';
import { ProcessingMetricsService } from './services/processing-metrics.service';
import { ProcessingStorageService } from './services/processing-storage.service';
import { ValidationOrchestratorService } from './services/validation-orchestrator.service';
import { StorageModule } from '../storage/storage.module';

// Import entities
import { ExpenseDocument, Receipt, FileHash, DocumentReference } from './entities';
import { ReceiptProcessingResult } from './entities/receipt-processing-result.entity';

// Import repositories and services
import { ReceiptProcessingResultRepository } from './repositories/receipt-processing-result.repository';
import { ReceiptResultsQueryService } from './services/receipt-results-query.service';
import { ReceiptResultsController } from './controllers/receipt-results.controller';
import { ExpenseStatusService } from './services/expense-status.service';
import { ExpenseStatusController } from './controllers/expense-status.controller';

// Import document splitter dependencies
import { DocumentSplitterModule } from '../document-splitter/document-splitter.module';

// Import country policy module for compliance data
import { CountryPolicyModule } from '../country-policy/country-policy.module';

import { QUEUE_NAMES } from '../types';
import * as multer from 'multer';
import * as path from 'path';

@Module({
  imports: [
    // Register TypeORM entities for this module
    TypeOrmModule.forFeature([ExpenseDocument, Receipt, FileHash, DocumentReference, ReceiptProcessingResult]),

    // Import storage module for file operations
    StorageModule,

    // Import country policy module for compliance data
    CountryPolicyModule,

    // Import document splitter module for persistence services (using forwardRef to avoid circular dependency)
    forwardRef(() => DocumentSplitterModule),

    // Register the queue with proper configuration and processor
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXPENSE_PROCESSING,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Note: BullMQ doesn't support timeout in defaultJobOptions
        // Implement timeout handling in the processor if needed
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
            // Generate unique filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
          },
        }),
        fileFilter: (req, file, cb) => {
          // Accept PDF files and common image formats
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
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute per IP
      },
    ]),
  ],
  controllers: [DocumentController, ReceiptResultsController, ExpenseStatusController],
  providers: [
    DocumentService,
    AgentFactoryService,
    ProcessingMetricsService,
    ProcessingStorageService,
    ValidationOrchestratorService,
    ExpenseProcessingService,
    ExpenseProcessor,
    ProcessingService,
    // New providers for receipt processing results
    ReceiptProcessingResultRepository,
    ReceiptResultsQueryService,
    // Expense status service
    ExpenseStatusService,
  ],
  exports: [
    DocumentService,
    AgentFactoryService,
    ProcessingMetricsService,
    ProcessingStorageService,
    ValidationOrchestratorService,
    ReceiptProcessingResultRepository,
    ReceiptResultsQueryService,
  ],
})
export class DocumentModule {}
