import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis-health.indicator';

/**
 * Health Module
 *
 * Provides health check endpoints for system monitoring.
 * Checks Redis (job queue) and database connectivity.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
  exports: [RedisHealthIndicator],
})
export class HealthModule {}
