import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * MigrationService - Provides manual database migration control via API endpoints
 *
 * This service exposes migration utilities that can be triggered manually via HTTP endpoints.
 * It complements TypeORM's built-in migrationsRun (which auto-executes on app startup).
 *
 * Use Cases:
 * - Manual migration execution in production (emergency fixes)
 * - Migration status checks for health monitoring
 * - Migration history inspection for debugging
 * - On-demand migration execution during blue-green deployments
 *
 * Features:
 * - Manual migration execution with detailed logging
 * - Transaction-based migration with automatic rollback on failure
 * - Connection health checks before migration
 * - Migration history and status inspection
 * - Works with both TypeScript (dev) and JavaScript (prod) migrations
 *
 * Safety Notes:
 * - Endpoints should be protected with authentication/authorization
 * - Migrations run in transactions (configured in database.ts)
 * - Failed migrations trigger automatic rollback
 * - Recommended to restrict access to admin users only
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute pending database migrations
   *
   * Process:
   * 1. Verify database connection
   * 2. Check for pending migrations
   * 3. Execute migrations in transaction
   * 4. Log results
   *
   * @throws Error if migrations fail
   */
  async runMigrations(): Promise<{ success: boolean; message: string; migrations: string[] }> {
    try {
      // Ensure database connection is established
      if (!this.dataSource.isInitialized) {
        this.logger.log('Initializing database connection...');
        await this.dataSource.initialize();
      }

      // Verify connection health
      await this.verifyConnection();

      // Get list of pending migrations
      const pendingMigrations = await this.dataSource.showMigrations();

      if (!pendingMigrations) {
        this.logger.log('✓ Database schema is up to date. No migrations to run.');
        return {
          success: true,
          message: 'Database schema is up to date. No migrations to run.',
          migrations: [],
        };
      }

      this.logger.log('Found pending migrations. Executing migrations...');

      // Execute all pending migrations
      // Each migration runs in its own transaction (configured in database.ts)
      const executedMigrations = await this.dataSource.runMigrations({
        transaction: 'each', // Safety: each migration in its own transaction
      });

      const migrationNames = executedMigrations.map((m) => m.name);

      if (executedMigrations.length === 0) {
        this.logger.log('✓ No new migrations executed. Database is current.');
        return {
          success: true,
          message: 'No new migrations executed. Database is current.',
          migrations: [],
        };
      } else {
        this.logger.log(
          `✓ Successfully executed ${executedMigrations.length} migration(s):`,
        );
        executedMigrations.forEach((migration) => {
          this.logger.log(`  - ${migration.name}`);
        });

        // Log current migration status
        await this.logMigrationStatus();

        return {
          success: true,
          message: `Successfully executed ${executedMigrations.length} migration(s)`,
          migrations: migrationNames,
        };
      }
    } catch (error) {
      this.logger.error('Failed to execute migrations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Migration execution failed: ${errorMessage}`,
        migrations: [],
      };
    }
  }

  /**
   * Verify database connection is healthy
   * @throws Error if connection check fails
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log('✓ Database connection verified');
    } catch (error) {
      this.logger.error('Database connection check failed:', error);
      throw new Error('Cannot execute migrations: Database connection unavailable');
    }
  }

  /**
   * Log current migration status for visibility
   */
  private async logMigrationStatus(): Promise<void> {
    try {
      const migrations = await this.dataSource.showMigrations();

      if (migrations) {
        this.logger.warn('⚠ There are still pending migrations in the database');
      } else {
        this.logger.log('✓ All migrations have been applied successfully');
      }
    } catch (error) {
      this.logger.warn('Could not retrieve migration status:', error);
    }
  }

  /**
   * Utility method to get migration history
   * Useful for health checks and debugging
   */
  async getMigrationHistory(): Promise<any[]> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      const migrations = await queryRunner.query(
        `SELECT * FROM ${this.dataSource.options.migrationsTableName || 'migrations'} ORDER BY timestamp DESC`,
      );
      await queryRunner.release();
      return migrations;
    } catch (error) {
      this.logger.error('Failed to retrieve migration history:', error);
      return [];
    }
  }

  /**
   * Check if there are pending migrations
   * Useful for health checks
   */
  async hasPendingMigrations(): Promise<boolean> {
    try {
      return await this.dataSource.showMigrations();
    } catch (error) {
      this.logger.error('Failed to check pending migrations:', error);
      return false;
    }
  }
}
