import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { MySqlHealthIndicator } from './indicators/mysql.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { AwsServicesHealthIndicator } from './indicators/aws-services.health';
import { CircuitBreakerHealthIndicator } from './indicators/circuit-breaker.health';

@Controller('expenses-ai')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mysqlHealth: MySqlHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly awsServices: AwsServicesHealthIndicator,
    private readonly circuitBreaker: CircuitBreakerHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.mysqlHealth.isHealthy('mysql'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.mysqlHealth.isHealthy('mysql'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  liveness(): Promise<HealthCheckResult> {
    // Liveness only checks if the application is running
    // Does not check external dependencies
    return this.health.check([]);
  }

  @Get('health/aws/textract')
  @HealthCheck()
  checkTextract(): Promise<HealthCheckResult> {
    return this.health.check([() => this.awsServices.checkTextract('textract')]);
  }

  @Get('health/aws/bedrock')
  @HealthCheck()
  checkBedrock(): Promise<HealthCheckResult> {
    return this.health.check([() => this.awsServices.checkBedrock('bedrock')]);
  }

  @Get('health/circuit-breakers')
  @HealthCheck()
  getCircuitBreakerStatus(): Promise<HealthCheckResult> {
    return this.health.check([() => this.circuitBreaker.getSummary('circuit-breakers')]);
  }

  @Get('health/rate-limiter')
  @HealthCheck()
  getRateLimiterStatus(): Promise<HealthCheckResult> {
    return this.health.check([() => this.circuitBreaker.getRateLimiterMetrics('rate-limiter')]);
  }
}
