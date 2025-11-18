import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DataSource } from 'typeorm';

/**
 * Enhanced Database Health Indicator
 *
 * Performs meaningful health checks on the database connection by:
 * - Querying MySQL system variables (not dependent on application tables)
 * - Verifying read permissions
 * - Testing connection pool availability
 * - Measuring query response time
 *
 * This ensures the database is truly functional, not just "pingable"
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  /**
   * Comprehensive database health check
   * Tests actual query execution against system tables
   *
   * @param key - The key to use in the health check result
   * @param timeoutMs - Query timeout in milliseconds (default: 5000)
   */
  async isHealthy(key: string, timeoutMs = 5000): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      // Check if DataSource is initialized
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      // Execute a meaningful system query with timeout
      // Queries MySQL system variables which don't depend on application tables
      const result = await Promise.race([
        this.executeDatabaseQuery(),
        this.timeoutPromise(timeoutMs),
      ]);

      const responseTime = Date.now() - startTime;

      // Parse result
      const { version, maxConnections, currentConnections } = result as any;

      this.logger.debug(
        `Database health check passed: MySQL ${version}, ` +
          `${currentConnections}/${maxConnections} connections, ` +
          `${responseTime}ms response time`,
      );

      return this.getStatus(key, true, {
        message: 'Database is operational',
        mysqlVersion: version,
        maxConnections,
        currentConnections,
        responseTime: `${responseTime}ms`,
        connectionPool: {
          status: 'healthy',
          utilizationPercent: Math.round((currentConnections / maxConnections) * 100),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(`Database health check failed: ${errorMessage}`);

      const result = this.getStatus(key, false, {
        message: errorMessage,
        status: 'unhealthy',
      });

      throw new HealthCheckError('Database health check failed', result);
    }
  }

  /**
   * Execute meaningful database query
   * Queries MySQL system variables and connection statistics
   */
  private async executeDatabaseQuery(): Promise<{
    version: string;
    maxConnections: number;
    currentConnections: number;
  }> {
    try {
      // Query MySQL system variables - these are always available
      // and don't depend on application schema
      const [systemVars] = await this.dataSource.query(`
        SELECT
          @@version as version,
          @@max_connections as maxConnections,
          (SELECT COUNT(*) FROM information_schema.PROCESSLIST) as currentConnections
      `);

      return {
        version: systemVars.version,
        maxConnections: parseInt(systemVars.maxConnections, 10),
        currentConnections: parseInt(systemVars.currentConnections, 10),
      };
    } catch (error) {
      this.logger.error('Failed to query database system variables:', error);
      throw error;
    }
  }

  /**
   * Create timeout promise for query execution
   */
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Database query timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Check migration status
   * Useful for ensuring database schema is up-to-date
   */
  async checkMigrationStatus(): Promise<HealthIndicatorResult> {
    try {
      const hasPending = await this.dataSource.showMigrations();

      if (hasPending) {
        this.logger.warn('Database has pending migrations');
        return this.getStatus('migrations', false, {
          message: 'Pending migrations detected',
          hasPendingMigrations: true,
          recommendation: 'Run migrations via CLI or POST /migrations/run endpoint',
        });
      }

      return this.getStatus('migrations', true, {
        message: 'All migrations applied',
        hasPendingMigrations: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Migration status check failed: ${errorMessage}`);

      return this.getStatus('migrations', false, {
        message: `Failed to check migration status: ${errorMessage}`,
      });
    }
  }
}
