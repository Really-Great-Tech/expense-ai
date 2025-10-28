import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentSplitterController } from './document-splitter.controller';
import { DocumentSplitterService } from './document-splitter.service';
import { FileValidationService } from './services/file-validation.service';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { DocumentParsingService } from './services/document-parsing.service';
import { PdfSplittingService } from './services/pdf-splitting.service';
import { DocumentStorageService } from './services/document-storage.service';
import { DocumentPersistenceService } from './services/document-persistence.service';
import { ProcessingQueueService } from './services/processing-queue.service';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';
import { StorageModule } from '../storage/storage.module';
import { CountryPolicyModule } from '../country-policy/country-policy.module';
import { DocumentModule } from '../document/document.module';
import { QUEUE_NAMES } from '../types';
import { ExpenseDocument } from '../document/entities/expense-document.entity';
import { Receipt } from '../document/entities/receipt.entity';
import { Country } from '../country-policy/entities/country.entity';
import { FileHash } from '../document/entities/file-hash.entity';
import { DocumentReference } from '../document/entities/document-reference.entity';

@Module({
  imports: [
    StorageModule,
    CountryPolicyModule, // Import for country validation
    forwardRef(() => DocumentModule), // Import for ReceiptProcessingResultRepository (using forwardRef to avoid circular dependency)
    TypeOrmModule.forFeature([ExpenseDocument, Receipt, Country, FileHash, DocumentReference]),
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXPENSE_PROCESSING,
    }),
  ],
  controllers: [DocumentSplitterController],
  providers: [
    DocumentSplitterService,
    FileValidationService,
    DuplicateDetectionService,
    DocumentParsingService,
    PdfSplittingService,
    DocumentStorageService,
    DocumentPersistenceService,
    ProcessingQueueService,
    {
      provide: DocumentSplitterAgent,
      useFactory: () => {
        const provider: 'bedrock' | 'anthropic' = 'bedrock';
        return new DocumentSplitterAgent(provider);
      },
    },
  ],
  exports: [DocumentSplitterService, DocumentPersistenceService],
})
export class DocumentSplitterModule {}
