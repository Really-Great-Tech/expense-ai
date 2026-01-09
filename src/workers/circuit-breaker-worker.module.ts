import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CircuitBreakerQueueService } from './services/circuit-breaker-queue.service';
import { CircuitBreakerWorkerService } from './services/circuit-breaker-worker.service';
import { RedisConfigService } from '@/config/redis.config';
import { CircuitBreakerService } from '@/resilience/circuit-breaker.service';

/**
 * Circuit Breaker Worker Module
 *
 * Provides queue and worker services for processing circuit breaker requests
 * when circuits are in half-open state.
 * ResilienceModule is global, so CircuitBreakerService can be injected directly.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    RedisConfigService,
    CircuitBreakerQueueService,
    CircuitBreakerWorkerService,
  ],
  exports: [CircuitBreakerQueueService, CircuitBreakerWorkerService],
})
export class CircuitBreakerWorkerModule implements OnModuleInit {
  constructor(
    private readonly queueService: CircuitBreakerQueueService,
    private readonly workerService: CircuitBreakerWorkerService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Initialize queue service
    await this.queueService.initialize();

    // Connect circuit breaker service to queue/worker services
    this.circuitBreakerService.setQueueServices(this.queueService, this.workerService);
  }
}
