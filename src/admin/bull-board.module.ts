import { Module, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { BullModule } from '@nestjs/bullmq';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../common/constants/queue.constants';

/**
 * Bull Board Admin Module
 *
 * Provides a web-based dashboard for monitoring BullMQ queues.
 * Available at /admin/queues when the application is running.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.EXPENSE_PROCESSING }, { name: QUEUE_NAMES.DOCUMENT_SPLITTING }),
  ],
})
export class BullBoardModule implements NestModule, OnModuleInit {
  private serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue(QUEUE_NAMES.EXPENSE_PROCESSING)
    private readonly expenseQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DOCUMENT_SPLITTING)
    private readonly splittingQueue: Queue,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/expenses-ai/admin/queues');
  }

  onModuleInit() {
    createBullBoard({
      queues: [new BullMQAdapter(this.expenseQueue), new BullMQAdapter(this.splittingQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(this.serverAdapter.getRouter()).forRoutes('/expenses-ai/admin/queues');
  }
}
