import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';

/**
 * Health Check Controller
 *
 * Provides comprehensive health check endpoints for monitoring system health.
 * Used by load balancers, monitoring systems, and DevOps tooling.
 *
 * Endpoint Types:
 * - Basic checks: Simple ping-based health checks (fast, lightweight)
 * - Enhanced checks: Meaningful operational tests with read/write operations
 * - Migration checks: Database schema validation
 */
@ApiTags('health')
@Controller('expenses-ai')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
    private dbEnhanced: DatabaseHealthIndicator,
    private redisEnhanced: RedisHealthEnhancedIndicator,
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
   * Database-only health check (basic ping)
   */
  @Get('health/database')
  @HealthCheck()
  @ApiOperation({ summary: 'Check database health only (basic ping)' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  checkDatabase() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  /**
   * Enhanced database health check
   * Tests actual database operations by querying MySQL system variables
   * More comprehensive than a simple ping - verifies read permissions and query execution
   */
  @Get('health/database/enhanced')
  @HealthCheck()
  @ApiOperation({
    summary: 'Enhanced database health check',
    description:
      'Performs meaningful database test by querying MySQL system variables. ' +
      'Returns MySQL version, connection pool stats, and query latency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Database is fully operational',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: {
            status: 'up',
            message: 'Database is operational',
            mysqlVersion: '8.0.35',
            maxConnections: 151,
            currentConnections: 5,
            responseTime: '12ms',
            connectionPool: {
              status: 'healthy',
              utilizationPercent: 3,
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  checkDatabaseEnhanced() {
    return this.health.check([() => this.dbEnhanced.isHealthy('database')]);
  }

  /**
   * Enhanced Redis health check
   * Tests actual Redis operations with read/write operations
   * More comprehensive than a simple ping - verifies data persistence
   */
  @Get('health/redis/enhanced')
  @HealthCheck()
  @ApiOperation({
    summary: 'Enhanced Redis health check',
    description:
      'Performs meaningful Redis test by executing write, read, and delete operations. ' +
      'Returns operation latencies and Redis server info.',
  })
  @ApiResponse({
    status: 200,
    description: 'Redis is fully operational',
    schema: {
      example: {
        status: 'ok',
        info: {
          'redis-queue': {
            status: 'up',
            message: 'Redis is fully operational',
            operations: {
              write: 'success',
              read: 'success',
              delete: 'success',
            },
            latency: {
              write: '8ms',
              read: '3ms',
              total: '15ms',
            },
            server: {
              version: '7.0.11',
              uptimeSeconds: 86400,
              connectedClients: 2,
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  checkRedisEnhanced() {
    return this.health.check([() => this.redisEnhanced.isHealthy('redis-queue')]);
  }

  /**
   * Database migration status check
   * Verifies that all migrations have been applied
   */
  @Get('health/database/migrations')
  @HealthCheck()
  @ApiOperation({
    summary: 'Check database migration status',
    description: 'Verifies that all database migrations have been applied.',
  })
  @ApiResponse({
    status: 200,
    description: 'All migrations applied',
    schema: {
      example: {
        status: 'ok',
        info: {
          migrations: {
            status: 'up',
            message: 'All migrations applied',
            hasPendingMigrations: false,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Pending migrations detected',
    schema: {
      example: {
        status: 'error',
        error: {
          migrations: {
            status: 'down',
            message: 'Pending migrations detected',
            hasPendingMigrations: true,
            recommendation: 'Run migrations via CLI or POST /migrations/run endpoint',
          },
        },
      },
    },
  })
  checkMigrations() {
    return this.health.check([() => this.dbEnhanced.checkMigrationStatus()]);
  }
}
