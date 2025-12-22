import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Import modules
import { StorageModule } from '../storage/storage.module';
import { CountryPolicyModule } from '../country-policy/country-policy.module';
import { ExpenseDocumentModule } from '../expense-document/expense-document.module';
import { ExpenseResultModule } from '../expense-result/expense-result.module';

// Processors
import { ExpenseProcessor } from './expense.processor';
import { DocumentSplitterProcessor } from './document-splitter.processor';

// Services
import { ExpenseProcessingService } from './services/expense-processing.service';
import { AgentFactoryService } from './services/agent-factory.service';
import { ProcessingMetricsService } from './services/processing-metrics.service';
import { ProcessingStorageService } from './services/processing-storage.service';
import { ValidationOrchestratorService } from './services/validation-orchestrator.service';
import { PdfToImageService } from '../services/pdf-conversion/pdf-to-image.service';
import { DocumentParsingService } from '../services/document-parsing/document-parsing.service';
import { DocumentSplitterAgent } from '../agents/document-splitter.agent';

import { QUEUE_NAMES } from '../common/types';

@Module({
  imports: [
    StorageModule,
    CountryPolicyModule,
    ExpenseDocumentModule,
    ExpenseResultModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EXPENSE_PROCESSING },
      { name: QUEUE_NAMES.DOCUMENT_SPLITTING },
    ),
  ],
  providers: [
    ExpenseProcessor,
    DocumentSplitterProcessor,
    ExpenseProcessingService,
    AgentFactoryService,
    ProcessingMetricsService,
    ProcessingStorageService,
    ValidationOrchestratorService,
    PdfToImageService,
    DocumentParsingService,
    {
      provide: DocumentSplitterAgent,
      useFactory: () => new DocumentSplitterAgent(),
    },
  ],
  exports: [ExpenseProcessingService, AgentFactoryService],
})
export class WorkersModule {}
