import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfigType } from '../../config/app.config';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const appConfig = this.configService.get<AppConfigType>('app');
      const host = appConfig?.redis?.host || 'localhost';
      const port = appConfig?.redis?.port || 6379;

      if (!this.client) {
        this.client = new Redis({
          host,
          port,
          lazyConnect: true,
          connectTimeout: 5000,
        });
      }

      await this.client.ping();

      return this.getStatus(key, true, {
        host,
        port,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { message: errorMessage }),
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
