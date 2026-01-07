import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MySqlHealthIndicator extends HealthIndicator {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.dataSource.query('SELECT 1');

      return this.getStatus(key, true, {
        database: this.dataSource.options.database,
        connected: this.dataSource.isInitialized,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HealthCheckError(
        `${key} health check failed`,
        this.getStatus(key, false, { message: errorMessage }),
      );
    }
  }
}
