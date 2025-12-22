import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { RedisHealthEnhancedIndicator } from './redis-health-enhanced.indicator';
import { AwsServicesHealthIndicator } from './aws-services-health.indicator';
import { CircuitBreakerHealthIndicator } from './circuit-breaker-health.indicator';

/**
 * Health Check Controller
 *
 * Provides comprehensive health check endpoints for monitoring system health.
 * Used by load balancers, monitoring systems, and DevOps tooling.
 *
 * All Redis checks use RedisHealthEnhancedIndicator with proper TLS validation.
 */
@ApiTags('health')
@Controller('expenses-ai')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private dbEnhanced: DatabaseHealthIndicator,
    private redisEnhanced: RedisHealthEnhancedIndicator,
    private awsServices: AwsServicesHealthIndicator,
    private circuitBreaker: CircuitBreakerHealthIndicator,
  ) {}

  /**
   * Complete health check - checks all dependencies with full details
   * Returns connection pool utilization, Redis stats, and BullMQ queue info
   */
  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Check overall system health' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 503, description: 'System is unhealthy' })
  check() {
    return this.health.check([
      // Check database connection with pool utilization metrics
      () => this.dbEnhanced.isHealthy('database'),

      // Check Redis connection (BullMQ job queue) - uses enhanced indicator with proper TLS
      () => this.redisEnhanced.isHealthy('redis-queue'),
    ]);
  }

  /**
   * Readiness check endpoint - indicates pod is ready to accept traffic
   * Checks critical dependencies (database, Redis) before returning healthy
   * Used by Kubernetes readiness probes to control traffic routing
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Check if application is ready to accept requests' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redisEnhanced.isHealthy('redis-queue', 5000, false), // Skip BullMQ for faster readiness
    ]);
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
    return this.health.check([() => this.redisEnhanced.isHealthy('redis-queue')]);
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
              region: 'eu-west-1',
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
   */
  @Get('health/aws/bedrock')
  @HealthCheck()
  @ApiOperation({
    summary: 'Check AWS Bedrock service health',
    description: 'Tests AWS Bedrock connectivity by sending a minimal test prompt',
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
            message: 'Bedrock is operational',
            latency: '1823ms',
            details: {
              region: 'eu-west-1',
              credentialsSource: 'explicit',
              modelId: 'us.amazon.nova-pro-v1:0',
              modelType: 'nova',
              apiUsed: 'Converse',
              responseText: 'OK',
              usage: {
                inputTokens: 12,
                outputTokens: 3,
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Bedrock is unavailable' })
  checkBedrock() {
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

  /**
   * Circuit breaker status endpoint
   * Returns status of all circuit breakers for monitoring dashboards
   */
  @Get('health/circuit-breakers')
  @ApiOperation({
    summary: 'Get circuit breaker status',
    description: 'Returns status of all circuit breakers. Does not fail on open circuits - use for monitoring.',
  })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker status',
    schema: {
      example: {
        status: 'ok',
        info: {
          'circuit-breakers': {
            status: 'up',
            summary: {
              total: 4,
              closed: 3,
              halfOpen: 0,
              open: 1,
            },
            circuits: [
              { name: 'bedrock', state: 'open' },
              { name: 'textract', state: 'closed' },
              { name: 's3', state: 'closed' },
              { name: 'database', state: 'closed' },
            ],
          },
        },
      },
    },
  })
  getCircuitBreakerStatus() {
    return this.health.check([() => this.circuitBreaker.getSummary('circuit-breakers')]);
  }
}
