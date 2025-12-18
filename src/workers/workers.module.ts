import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Import modules
import { StorageModule } from '../storage/storage.module';
import { CountryPolicyModule } from '../country-policy/country-policy.module';
import { ExpenseDocumentModule } from '../expense-document/expense-document.module';
import { ExpenseResultModule } from '../expense-result/expense-result.module';

// Processor
import { ExpenseProcessor } from './expense.processor';

// Services
import { ExpenseProcessingService } from './services/expense-processing.service';
import { AgentFactoryService } from './services/agent-factory.service';
import { ProcessingMetricsService } from './services/processing-metrics.service';
import { ProcessingStorageService } from './services/processing-storage.service';
import { ValidationOrchestratorService } from './services/validation-orchestrator.service';

import { QUEUE_NAMES } from '../common/types';

@Module({
  imports: [
    StorageModule,
    CountryPolicyModule,
    ExpenseDocumentModule,
    ExpenseResultModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXPENSE_PROCESSING,
    }),
  ],
  providers: [
    ExpenseProcessor,
    ExpenseProcessingService,
    AgentFactoryService,
    ProcessingMetricsService,
    ProcessingStorageService,
    ValidationOrchestratorService,
  ],
  exports: [ExpenseProcessingService, AgentFactoryService],
})
export class WorkersModule {}
