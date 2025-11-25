import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis-health.indicator';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import { RedisDebugService } from './redis-debug.service';

/**
 * Health Module
 *
 * Provides comprehensive health check endpoints for system monitoring.
 * Includes both basic (ping-based) and enhanced (operational) health checks.
 *
 * Features:
 * - Basic health checks: Fast ping tests for load balancers
 * - Enhanced health checks: Meaningful operational tests (read/write)
 * - Migration status checks: Database schema validation
 * - Debug diagnostics: Redis/Bull configuration testing
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    DatabaseHealthIndicator,
    RedisHealthEnhancedIndicator,
    RedisDebugService,
  ],
  exports: [
    RedisHealthIndicator,
    DatabaseHealthIndicator,
    RedisHealthEnhancedIndicator,
    RedisDebugService,
  ],
})
export class HealthModule {}
