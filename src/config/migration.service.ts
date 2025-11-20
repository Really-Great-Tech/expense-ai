import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

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

      // Log migration configuration for debugging
      this.logger.log('Migration configuration:', {
        migrationsTableName: this.dataSource.options.migrationsTableName,
        migrationsPath: this.dataSource.options.migrations,
        totalMigrationsRegistered: this.dataSource.migrations?.length || 0,
      });

      // List all registered migrations
      if (this.dataSource.migrations && this.dataSource.migrations.length > 0) {
        this.logger.log('Registered migrations:');
        this.dataSource.migrations.forEach((migration, index) => {
          this.logger.log(`  ${index + 1}. ${migration.name}`);
        });
      } else {
        this.logger.warn(' No migrations are registered with TypeORM!');
        this.logger.warn('This usually means migration files are not being loaded.');
      }

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
        this.logger.warn('There are still pending migrations in the database');
      } else {
        this.logger.log(' All migrations have been applied successfully');
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
      // Log the table name being queried
      const tableName = this.dataSource.options.migrationsTableName || 'migrations';
      this.logger.log(`Querying migration history from table: ${tableName}`);

      const queryRunner = this.dataSource.createQueryRunner();

      // Check if table exists first
      const tableExists = await queryRunner.query(
        `SHOW TABLES LIKE '${tableName}'`,
      );

      if (!tableExists || tableExists.length === 0) {
        this.logger.warn(`Migration table '${tableName}' does not exist. No migrations have been run yet.`);
        await queryRunner.release();
        return [];
      }

      const migrations = await queryRunner.query(
        `SELECT * FROM ${tableName} ORDER BY timestamp DESC`,
      );

      this.logger.log(`Found ${migrations.length} migration(s) in history`);
      await queryRunner.release();
      return migrations;
    } catch (error) {
      this.logger.error('Failed to retrieve migration history:', error);
      this.logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
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

  /**
   * List actual migration files on disk
   * Scans the filesystem to find physical migration files
   */
  async listMigrationFiles(): Promise<{
    filesFound: string[];
    pathsChecked: string[];
    workingDirectory: string;
  }> {
    const cwd = process.cwd();
    const filesFound: string[] = [];
    const pathsChecked: string[] = [];

    // Define paths to check (same as database.ts)
    const pathsToCheck = [
      path.join(cwd, 'dist', 'src', 'migrations'),
      path.join(cwd, 'dist', 'migrations'),
      path.join(cwd, 'src', 'migrations'),
    ];

    this.logger.log('Scanning filesystem for migration files...');
    this.logger.log(`Working directory: ${cwd}`);

    for (const checkPath of pathsToCheck) {
      pathsChecked.push(checkPath);

      // Check if directory exists
      if (fs.existsSync(checkPath)) {
        this.logger.log(`Found directory: ${checkPath}`);

        try {
          // Find all .js or .ts migration files
          const pattern = path.join(checkPath, '*.{js,ts}');
          const files = await glob(pattern);

          if (files.length > 0) {
            this.logger.log(`Found ${files.length} file(s) in ${checkPath}`);
            files.forEach((file: string) => {
              const relativePath = path.relative(cwd, file);
              filesFound.push(relativePath);
              this.logger.log(`  - ${relativePath}`);
            });
          } else {
            this.logger.log(`Directory exists but no migration files found: ${checkPath}`);
          }
        } catch (error) {
          this.logger.warn(`Error scanning ${checkPath}:`, error);
        }
      } else {
        this.logger.log(`Directory does not exist: ${checkPath}`);
      }
    }

    return {
      filesFound,
      pathsChecked,
      workingDirectory: cwd,
    };
  }

  /**
   * Get comprehensive migration diagnostics
   * Returns detailed information about migration loading and execution
   */
  async getDiagnostics(): Promise<{
    totalMigrationsRegistered: number;
    registeredMigrationNames: string[];
    executedMigrationsCount: number;
    migrationsTableName: string;
    migrationPaths: any;
    hasMigrationTable: boolean;
  }> {
    try {
      const tableName = this.dataSource.options.migrationsTableName || 'migrations';
      const totalRegistered = this.dataSource.migrations?.length || 0;
      const migrationNames = this.dataSource.migrations?.map((m) => m.name) || [];

      // Check if migration table exists
      const queryRunner = this.dataSource.createQueryRunner();
      const tableExists = await queryRunner.query(`SHOW TABLES LIKE '${tableName}'`);
      const hasMigrationTable = tableExists && tableExists.length > 0;

      // Get executed migrations count
      let executedCount = 0;
      if (hasMigrationTable) {
        const executed = await queryRunner.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        executedCount = executed[0]?.count || 0;
      }
      await queryRunner.release();

      return {
        totalMigrationsRegistered: totalRegistered,
        registeredMigrationNames: migrationNames,
        executedMigrationsCount: executedCount,
        migrationsTableName: tableName,
        migrationPaths: this.dataSource.options.migrations,
        hasMigrationTable,
      };
    } catch (error) {
      this.logger.error('Failed to get migration diagnostics:', error);
      return {
        totalMigrationsRegistered: 0,
        registeredMigrationNames: [],
        executedMigrationsCount: 0,
        migrationsTableName: 'unknown',
        migrationPaths: [],
        hasMigrationTable: false,
      };
    }
  }
}
