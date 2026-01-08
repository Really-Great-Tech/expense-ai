import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BedrockRateLimiterService } from './bedrock-rate-limiter.service';

/**
 * Resilience Module
 *
 * Provides circuit breaker and rate limiting patterns for external service calls.
 * Marked as @Global so it can be injected anywhere without importing.
 */
@Global()
@Module({
  providers: [CircuitBreakerService, BedrockRateLimiterService],
  exports: [CircuitBreakerService, BedrockRateLimiterService],
})
export class ResilienceModule {}
