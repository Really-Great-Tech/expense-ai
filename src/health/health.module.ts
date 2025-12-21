import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import { AwsServicesHealthIndicator } from './aws-services-health.indicator';
import { CircuitBreakerHealthIndicator } from './circuit-breaker-health.indicator';

/**
 * Health Module
 *
 * Provides comprehensive health check endpoints for system monitoring.
 * Uses enhanced health indicators for meaningful operational tests.
 *
 * Features:
 * - Redis health checks: Read/write operations with proper TLS validation
 * - Database health checks: Query execution and connection pool monitoring
 * - Migration status checks: Database schema validation
 * - AWS services health: Textract and Bedrock connectivity
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthEnhancedIndicator, AwsServicesHealthIndicator, CircuitBreakerHealthIndicator],
  exports: [DatabaseHealthIndicator, RedisHealthEnhancedIndicator, AwsServicesHealthIndicator, CircuitBreakerHealthIndicator],
})
export class HealthModule {}
