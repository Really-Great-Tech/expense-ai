import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';

/**
 * Health Check Controller
 *
 * Provides health check endpoints for monitoring system health.
 * Used by load balancers, monitoring systems, and DevOps tooling.
 */
@ApiTags('health')
@Controller('expenses-ai')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  /**
   * Complete health check - checks all dependencies
   */
  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Check overall system health' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 503, description: 'System is unhealthy' })
  check() {
    return this.health.check([
      // Check database connection
      () => this.db.pingCheck('database'),

      // Check Redis connection (BullMQ job queue)
      () => this.redis.isHealthy('redis-queue'),
    ]);
  }

  /**
   * Readiness check endpoint - indicates pod is ready to accept traffic
   * Returns 200 immediately without checking dependencies
   */
  @Get('ready')
  @ApiOperation({ summary: 'Check if application is ready to accept requests' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  ready() {
    return {
      status: 'ok',
      message: 'Application is ready to accept requests',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Redis-only health check
   */
  @Get('health/redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Check Redis/Queue health only' })
  @ApiResponse({ status: 200, description: 'Redis is healthy' })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  checkRedis() {
    return this.health.check([
      () => this.redis.isHealthy('redis-queue'),
    ]);
  }

  /**
   * Database-only health check
   */
  @Get('health/database')
  @HealthCheck()
  @ApiOperation({ summary: 'Check database health only' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  checkDatabase() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
