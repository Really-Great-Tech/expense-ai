import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IngestService } from './ingest.service';
import { QUEUE_NAMES } from '@/common/constants/queue.constants';
import { ExpenseDocument } from '@/expense-document/entities/expense-document.entity';
import { WorkflowModule } from '@/workflow/workflow.module';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EXPENSE_WORKFLOW }),
    TypeOrmModule.forFeature([ExpenseDocument]),
    WorkflowModule, // For JobRecordRepository
  ],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}
