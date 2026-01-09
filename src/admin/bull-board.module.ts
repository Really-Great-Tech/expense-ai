import { Module, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { BullModule } from '@nestjs/bullmq';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { CircuitBreakerWorkerModule } from '../workers/circuit-breaker-worker.module';
import { CircuitBreakerQueueService } from '../workers/services/circuit-breaker-queue.service';

/**
 * Bull Board Admin Module
 *
 * Provides a web-based dashboard for monitoring BullMQ queues.
 * Available at /admin/queues when the application is running.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.EXPENSE_WORKFLOW }),
    CircuitBreakerWorkerModule,
  ],
})
export class BullBoardModule implements NestModule, OnModuleInit {
  private serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue(QUEUE_NAMES.EXPENSE_WORKFLOW)
    private readonly workflowQueue: Queue,
    private readonly circuitBreakerQueueService: CircuitBreakerQueueService,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/expenses-ai/admin/queues');
  }

  onModuleInit() {
    const queues = [new BullMQAdapter(this.workflowQueue)];

    // Add circuit breaker queue if available
    const circuitBreakerQueue = this.circuitBreakerQueueService.getQueue();
    if (circuitBreakerQueue) {
      queues.push(new BullMQAdapter(circuitBreakerQueue));
    }

    createBullBoard({
      queues,
      serverAdapter: this.serverAdapter,
    });
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(this.serverAdapter.getRouter()).forRoutes('/expenses-ai/admin/queues');
  }
}
