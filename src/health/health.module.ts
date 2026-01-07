import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MySqlHealthIndicator } from './indicators/mysql.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { AwsServicesHealthIndicator } from './indicators/aws-services.health';
import { CircuitBreakerHealthIndicator } from './indicators/circuit-breaker.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MySqlHealthIndicator, RedisHealthIndicator, AwsServicesHealthIndicator, CircuitBreakerHealthIndicator],
  exports: [MySqlHealthIndicator, RedisHealthIndicator, AwsServicesHealthIndicator, CircuitBreakerHealthIndicator],
})
export class HealthModule {}
