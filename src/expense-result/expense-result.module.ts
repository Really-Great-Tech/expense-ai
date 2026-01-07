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
import { ExpenseStatusController } from './controllers/expense-status.controller';

// Services
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
  controllers: [ExpenseStatusController],
  providers: [ExpenseStatusService, QueueManagementService, ReceiptProcessingResultRepository],
  exports: [ExpenseStatusService, QueueManagementService, ReceiptProcessingResultRepository, TypeOrmModule],
})
export class ExpenseResultModule {}
