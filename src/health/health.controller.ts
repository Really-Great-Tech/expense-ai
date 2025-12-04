import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import { RedisDebugService } from './redis-debug.service';
import { AwsServicesHealthIndicator } from './aws-services-health.indicator';

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
    private redisDebug: RedisDebugService,
    private awsServices: AwsServicesHealthIndicator,
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

  /**
   * Redis/Bull Debug Diagnostic Endpoint
   * Tests both standalone and cluster Redis configurations with Bull queue operations
   * Use this to diagnose why jobs are not being triggered
   */
  @Get('health/redis/debug')
  @ApiOperation({
    summary: 'Debug Redis/Bull configuration',
    description: `
**Comprehensive diagnostic endpoint for debugging Redis and Bull queue issues.**

This endpoint tests BOTH standalone and cluster Redis configurations to identify:
- Which Redis connection mode works (standalone vs cluster)
- Whether Bull queue can add/remove jobs successfully
- Configuration mismatches (e.g., REDIS_CLUSTER_ENABLED=true when ElastiCache is not in cluster mode)

**Tests performed:**
1. Standalone Redis: connect, ping, write, read, delete
2. Cluster Redis: connect, ping, write, read, delete
3. Standalone Bull: create queue, add job, get counts, remove job
4. Cluster Bull: create queue, add job, get counts, remove job

**Use when:**
- Jobs are not being triggered (504 timeout on upload)
- Redis health checks pass but Bull operations fail
- Uncertain whether ElastiCache is in cluster mode or not

**Note:** This endpoint may take 30-60 seconds to complete all tests.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Debug diagnostic completed',
    schema: {
      example: {
        timestamp: '2025-01-15T10:30:00Z',
        environment: {
          REDIS_MODE: 'managed',
          REDIS_HOST: 'my-elasticache...',
          REDIS_CLUSTER_ENABLED: 'true',
        },
        standalone_redis_test: { overall_status: 'success', steps: [] },
        cluster_redis_test: { overall_status: 'failed', steps: [] },
        standalone_bull_test: { overall_status: 'success', steps: [] },
        cluster_bull_test: { overall_status: 'failed', steps: [] },
        diagnosis: {
          working_modes: ['standalone-redis', 'standalone-bull'],
          failing_modes: ['cluster-redis', 'cluster-bull'],
          root_cause: 'MISMATCH: REDIS_CLUSTER_ENABLED=true but ElastiCache is NOT in cluster mode',
          recommended_fix: 'Set REDIS_CLUSTER_ENABLED=false',
        },
      },
    },
  })
  async debugRedis() {
    return this.redisDebug.runFullDiagnostic();
  }

  /**
   * AWS Textract health check
   * Tests connectivity and functionality of AWS Textract service
   */
  @Get('health/aws/textract')
  @HealthCheck()
  @ApiOperation({
    summary: 'Check AWS Textract service health',
    description: 'Tests AWS Textract connectivity by processing a minimal test image',
  })
  @ApiResponse({
    status: 200,
    description: 'Textract is operational',
    schema: {
      example: {
        status: 'ok',
        info: {
          textract: {
            status: 'up',
            message: 'Textract is operational',
            latency: '245ms',
            details: {
              region: 'us-east-1',
              blocksDetected: 1,
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Textract is unavailable' })
  checkTextract() {
    return this.health.check([() => this.awsServices.checkTextract('textract')]);
  }

  /**
   * AWS Bedrock health check
   * Tests connectivity and functionality of AWS Bedrock service
   * Uses Application Inference Profiles if USING_APPLICATION_PROFILE=true
   */
  @Get('health/aws/bedrock')
  @HealthCheck()
  @ApiOperation({
    summary: 'Check AWS Bedrock service health',
    description: 'Tests AWS Bedrock connectivity. Uses Application Inference Profiles if configured.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bedrock is operational',
    schema: {
      example: {
        status: 'ok',
        info: {
          bedrock: {
            status: 'up',
            message: 'All 5 Application Inference Profiles operational',
            latency: '2104ms',
            details: {
              region: 'eu-west-1',
              credentialsSource: 'explicit',
              usingApplicationProfile: true,
              summary: { total: 5, up: 5, down: 0 },
              profiles: [
                {
                  name: 'BEDROCK_MODEL',
                  arn: 'arn:aws:bedrock:eu-west-1:400708341202:application-inference-profile/egt2tngo3h5y',
                  status: 'up',
                  latency: '1109ms',
                  tokens: { input: 10, output: 5 },
                },
              ],
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Bedrock is unavailable' })
  checkBedrock() {
    const usingApplicationProfile = process.env.USING_APPLICATION_PROFILE?.toLowerCase() === 'true';
    if (usingApplicationProfile) {
      return this.health.check([() => this.awsServices.checkBedrockApplicationProfiles('bedrock')]);
    }
    return this.health.check([() => this.awsServices.checkBedrock('bedrock')]);
  }

  /**
   * AWS Services comprehensive health check
   * Tests both Textract and Bedrock services
   */
  @Get('health/aws')
  @HealthCheck()
  @ApiOperation({
    summary: 'Check all AWS services health',
    description: 'Tests connectivity and functionality of both AWS Textract and Bedrock services',
  })
  @ApiResponse({
    status: 200,
    description: 'All AWS services are operational',
    schema: {
      example: {
        status: 'ok',
        info: {
          'aws-services': {
            status: 'up',
            message: 'All AWS services are operational',
            services: {
              textract: {
                status: 'up',
                message: 'Textract is operational',
                latency: '245ms',
              },
              bedrock: {
                status: 'up',
                message: 'Bedrock is operational',
                latency: '1823ms',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Some AWS services are unavailable',
    schema: {
      example: {
        status: 'error',
        error: {
          'aws-services': {
            status: 'down',
            message: 'Some AWS services are unavailable',
            services: {
              textract: {
                status: 'up',
                message: 'Textract is operational',
              },
              bedrock: {
                status: 'down',
                message: 'Bedrock is unavailable',
                error: 'AccessDeniedException: User not authorized',
              },
            },
          },
        },
      },
    },
  })
  checkAwsServices() {
    return this.health.check([() => this.awsServices.checkAllServices('aws-services')]);
  }
}
