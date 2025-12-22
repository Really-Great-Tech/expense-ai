import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * Resilience Module
 *
 * Provides circuit breaker patterns for external service calls.
 * Marked as @Global so it can be injected anywhere without importing.
 */
@Global()
@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class ResilienceModule {}
