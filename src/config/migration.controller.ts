import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { MigrationService } from './migration.service';

/**
 * MigrationController - HTTP endpoints for manual migration management
 *
 * Provides API endpoints to:
 * - Manually trigger migrations in production
 * - Check migration status for monitoring
 * - View migration history for debugging
 * - Check for pending migrations
 *
 * Security Recommendations:
 * - Protect these endpoints with authentication/authorization
 * - Restrict access to admin users only
 * - Consider IP whitelisting for production
 * - Log all migration operations for audit trail
 *
 * Example Usage:
 * - POST /migrations/run       - Execute pending migrations
 * - GET  /migrations/status    - Check if migrations are pending
 * - GET  /migrations/history   - View migration history
 */
@ApiExcludeController()
@ApiTags('migrations')
@Controller('migrations')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  /**
   * Manually execute pending database migrations
   *
   * Use this endpoint to:
   * - Run migrations in production when auto-run is disabled
   * - Trigger migrations during maintenance windows
   * - Execute migrations during blue-green deployments
   *
   * @returns Migration execution result with list of executed migrations
   */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute pending migrations',
    description:
      'Manually run all pending database migrations. Each migration runs in its own transaction with automatic rollback on failure.',
  })
  @ApiResponse({
    status: 200,
    description: 'Migrations executed successfully',
    schema: {
      example: {
        success: true,
        message: 'Successfully executed 2 migration(s)',
        migrations: ['CreateInitialSchema1736500000000', 'SeedCountryPolicies1736504407000'],
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Migration execution failed',
    schema: {
      example: {
        success: false,
        message: 'Migration execution failed: Connection timeout',
        migrations: [],
      },
    },
  })
  async runMigrations() {
    return await this.migrationService.runMigrations();
  }

  /**
   * Check if there are pending migrations
   *
   * Use this endpoint for:
   * - Health checks in CI/CD pipelines
   * - Monitoring dashboards
   * - Pre-deployment validation
   *
   * @returns Boolean indicating if migrations are pending
   */
  @Get('status')
  @ApiOperation({
    summary: 'Check migration status',
    description: 'Returns whether there are pending migrations that need to be executed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration status retrieved successfully',
    schema: {
      example: {
        hasPendingMigrations: false,
        message: 'All migrations have been applied',
        registeredMigrations: 3,
        executedMigrations: 3,
      },
    },
  })
  async getMigrationStatus() {
    const diagnostics = await this.migrationService.getDiagnostics();
    const hasPending = await this.migrationService.hasPendingMigrations();

    return {
      hasPendingMigrations: hasPending,
      message: hasPending
        ? 'There are pending migrations that need to be executed'
        : 'All migrations have been applied',
      registeredMigrations: diagnostics.totalMigrationsRegistered,
      executedMigrations: diagnostics.executedMigrationsCount,
      warning: diagnostics.totalMigrationsRegistered === 0 ? 'WARNING: No migrations are registered! Check migration file loading.' : undefined,
    };
  }

  /**
   * Get migration history
   *
   * Use this endpoint for:
   * - Debugging migration issues
   * - Audit trail of database changes
   * - Verification of applied migrations
   *
   * @returns List of executed migrations with timestamps
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get migration history',
    description: 'Returns the list of all executed migrations with their timestamps.',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration history retrieved successfully',
    schema: {
      example: {
        migrations: [
          {
            id: 2,
            timestamp: '1736504407000',
            name: 'SeedCountryPolicies1736504407000',
          },
          {
            id: 1,
            timestamp: '1736500000000',
            name: 'CreateInitialSchema1736500000000',
          },
        ],
      },
    },
  })
  async getMigrationHistory() {
    const history = await this.migrationService.getMigrationHistory();
    return {
      migrations: history,
    };
  }

  /**
   * Get comprehensive migration diagnostics
   *
   * Use this endpoint for:
   * - Debugging why migrations aren't running
   * - Verifying migration file loading
   * - Checking migration configuration
   *
   * @returns Detailed migration system diagnostics
   */
  @Get('diagnostics')
  @ApiOperation({
    summary: 'Get migration diagnostics',
    description: 'Returns comprehensive diagnostics about migration loading, execution, and configuration. Use this to debug migration issues.',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration diagnostics retrieved successfully',
    schema: {
      example: {
        totalMigrationsRegistered: 3,
        registeredMigrationNames: ['CreateInitialSchema1736500000000', 'SeedCountryPolicies1736504407000', 'AddTestMigrationField1760508674074'],
        executedMigrationsCount: 3,
        migrationsTableName: 'expense_ai_migrations',
        migrationPaths: ['dist/src/migrations/*.js', 'dist/migrations/*.js'],
        hasMigrationTable: true,
        status: 'healthy',
        issues: [],
      },
    },
  })
  async getDiagnostics() {
    const diagnostics = await this.migrationService.getDiagnostics();

    // Analyze for issues
    const issues: string[] = [];
    if (diagnostics.totalMigrationsRegistered === 0) {
      issues.push('CRITICAL: No migrations are registered with TypeORM. Migration files may not be loading.');
      issues.push('Check: 1) Migration files exist in src/migrations/, 2) Files are being compiled to dist/, 3) TypeORM paths are correct');
    }
    if (!diagnostics.hasMigrationTable) {
      issues.push('WARNING: Migration tracking table does not exist. Migrations have never been run.');
    }
    if (diagnostics.totalMigrationsRegistered > 0 && diagnostics.executedMigrationsCount === 0) {
      issues.push('WARNING: Migrations are registered but none have been executed. Run migrations or check migrationsRun setting.');
    }

    const status = issues.length === 0 ? 'healthy' : issues.some((i) => i.startsWith('CRITICAL')) ? 'critical' : 'warning';

    return {
      ...diagnostics,
      status,
      issues,
      recommendations:
        status === 'critical'
          ? [
              'Verify migration files exist in src/migrations/',
              'Check Docker build is compiling TypeScript migrations',
              'Verify TypeORM configuration includes correct migration paths',
              'Check application logs for migration loading errors',
            ]
          : status === 'warning'
            ? [
                'Consider running migrations via POST /migrations/run endpoint',
                'Or ensure migrationsRun: true in database configuration',
                'Check database connectivity',
              ]
            : ['Migration system is operating normally'],
    };
  }

  /**
   * List actual migration files on disk
   *
   * Use this endpoint for:
   * - Verifying which files TypeORM can see
   * - Debugging migration file loading
   * - Confirming file compilation in Docker
   *
   * @returns List of migration files found on filesystem
   */
  @Get('files')
  @ApiOperation({
    summary: 'List migration files on disk',
    description: 'Scans the filesystem to find actual migration files. Checks dist/src/migrations, dist/migrations, and src/migrations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration files listed successfully',
    schema: {
      example: {
        filesFound: [
          'dist/migrations/1736500000000-CreateInitialSchema.js',
          'dist/migrations/1736504407000-SeedCountryPolicies.js',
          'dist/migrations/1760508674074-AddTestMigrationField.js',
        ],
        pathsChecked: ['/usr/src/app/dist/src/migrations', '/usr/src/app/dist/migrations', '/usr/src/app/src/migrations'],
        workingDirectory: '/usr/src/app',
      },
    },
  })
  async listMigrationFiles() {
    return await this.migrationService.listMigrationFiles();
  }
}
