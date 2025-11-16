import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
      },
    },
  })
  async getMigrationStatus() {
    const hasPending = await this.migrationService.hasPendingMigrations();
    return {
      hasPendingMigrations: hasPending,
      message: hasPending
        ? 'There are pending migrations that need to be executed'
        : 'All migrations have been applied',
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
}
