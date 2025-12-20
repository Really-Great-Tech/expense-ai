import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities - include ExpenseDocument and Receipt for TypeORM repository access
import { ReceiptProcessingResult } from './entities/receipt-processing-result.entity';
import { ExpenseDocument } from '@/expense-document/entities/expense-document.entity';
import { Receipt } from '@/expense-document/entities/receipt.entity';

// Repository
import { ReceiptProcessingResultRepository } from './repositories/receipt-processing-result.repository';

// Controllers
import { ReceiptResultsController } from './controllers/receipt-results.controller';
import { ExpenseStatusController } from './controllers/expense-status.controller';

// Services
import { ReceiptResultsQueryService } from './services/receipt-results-query.service';
import { ExpenseStatusService } from './services/expense-status.service';
import { QueueManagementService } from './services/queue-management.service';

import { QUEUE_NAMES } from '../common/types';

@Module({
  imports: [
    // Register all entities needed by this module's services
    TypeOrmModule.forFeature([ReceiptProcessingResult, ExpenseDocument, Receipt]),
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXPENSE_PROCESSING,
    }),
  ],
  controllers: [ReceiptResultsController, ExpenseStatusController],
  providers: [ReceiptResultsQueryService, ExpenseStatusService, QueueManagementService, ReceiptProcessingResultRepository],
  exports: [ReceiptResultsQueryService, ExpenseStatusService, QueueManagementService, ReceiptProcessingResultRepository, TypeOrmModule],
})
export class ExpenseResultModule {}
