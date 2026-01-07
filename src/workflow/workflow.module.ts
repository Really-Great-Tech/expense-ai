import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Import modules (forwardRef for circular dependency)
import { StorageModule } from '@/storage/storage.module';
import { CountryPolicyModule } from '@/country-policy/country-policy.module';
import { ExpenseDocumentModule } from '@/expense-document/expense-document.module';
import { ExpenseResultModule } from '@/expense-result/expense-result.module';

// Entities
import { JobRecord } from './entities/job-record.entity';

// Repositories
import { JobRecordRepository } from './repositories/job-record.repository';

// Services
import { FlowProducerService } from './services/flow-producer.service';
import { WorkerService } from './services/worker.service';
import { RedisConfigService } from '@/config/redis.config';

// Handlers
import { DocumentSplitterHandler } from './handlers/document-splitter.handler';
import { ReceiptProcessorHandler } from './handlers/receipt-processor.handler';
import { ResultAggregatorHandler } from './handlers/result-aggregator.handler';

// Existing services reused by handlers
import { ExpenseProcessingService } from '@/workers/services/expense-processing.service';
import { AgentFactoryService } from '@/workers/services/agent-factory.service';
import { ProcessingMetricsService } from '@/workers/services/processing-metrics.service';
import { ProcessingStorageService } from '@/workers/services/processing-storage.service';
import { ValidationOrchestratorService } from '@/workers/services/validation-orchestrator.service';
import { PdfToImageService } from '@/services/pdf-conversion/pdf-to-image.service';
import { DocumentParsingService } from '@/services/document-parsing/document-parsing.service';
import { DocumentSplitterAgent } from '@/agents/document-splitter.agent';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([JobRecord]),
    StorageModule,
    CountryPolicyModule,
    forwardRef(() => ExpenseDocumentModule),
    ExpenseResultModule,
  ],
  providers: [
    // Redis config
    RedisConfigService,

    // Repositories
    JobRecordRepository,

    // Services
    FlowProducerService,
    WorkerService,

    // Handlers
    DocumentSplitterHandler,
    ReceiptProcessorHandler,
    ResultAggregatorHandler,

    // Reused services from WorkersModule
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
  exports: [
    FlowProducerService,
    WorkerService,
    DocumentSplitterHandler,
    ReceiptProcessorHandler,
    ResultAggregatorHandler,
    JobRecordRepository,
    // Re-export for backwards compatibility
    ExpenseProcessingService,
    AgentFactoryService,
  ],
})
export class WorkflowModule {}
