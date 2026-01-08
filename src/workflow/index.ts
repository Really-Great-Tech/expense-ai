// Workflow Module - BullMQ FlowProducer Architecture
export { WorkflowModule } from './workflow.module';

// Services
export { FlowProducerService } from './services/flow-producer.service';
export { WorkerService, ProcessExpenseResult } from './services/worker.service';

// Handlers
export { DocumentSplitterHandler } from './handlers/document-splitter.handler';
export { ReceiptProcessorHandler } from './handlers/receipt-processor.handler';
export { ResultAggregatorHandler } from './handlers/result-aggregator.handler';

// Entities
export { JobRecord, JobType, JobStatus } from './entities/job-record.entity';

// Repositories
export { JobRecordRepository, CreateJobRecordParams } from './repositories/job-record.repository';

// Interfaces
export {
  SplitExpenseJobData,
  ProcessReceiptJobData,
  ProcessExpenseJobData,
  SplitResult,
  CreateExpenseFlowParams,
} from './interfaces/workflow-job-data.interface';
