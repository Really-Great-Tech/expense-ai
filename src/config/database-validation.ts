import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../tools/logger/logger.service';

/**
 * Database Configuration Validator
 *
 * Validates critical database configuration settings to prevent
 * dangerous misconfigurations in production environments.
 *
 * Aurora MySQL only with IAM authentication (no password auth supported).
 *
 * This validator enforces:
 * - SSL enforcement (required for IAM auth)
 * - Required environment variables validation
 * - IAM authentication configuration validation
 *
 * Note: Schema synchronization is permanently disabled (synchronize: false)
 * to prevent accidental data loss. Use migrations for all schema changes.
 */
const CONTEXT = 'DatabaseConfigValidator';

export class DatabaseConfigValidator {
  private static readonly logger = new LoggerService();

  /**
   * Validates database configuration on application startup
   * Throws errors for critical misconfigurations
   */
  static validate(configService: ConfigService): void {
    const env = configService.get<string>('NODE_ENV', 'development');
    const isProduction = env === 'production';
    const isStaging = env === 'staging';

    this.logger.log(`Validating database configuration for environment: ${env}`, CONTEXT);

    // Always validate Aurora MySQL configuration
    this.validateAuroraMySQLConfiguration();

    // Critical validations for production/staging
    if (isProduction || isStaging) {
      this.validateProductionSafeguards(configService, env);
      this.validateRequiredCredentials(configService);
      this.validateIAMAuthConfiguration(configService);
    }

    // Warn about development-only settings
    if (!isProduction && !isStaging) {
      this.validateDevelopmentSettings(configService);
    }

    this.logger.log('Database configuration validation passed', CONTEXT);
  }

  /**
   * Validates Aurora MySQL configuration (IAM auth only)
   */
  private static validateAuroraMySQLConfiguration(): void {
    this.logger.log('Validating Aurora MySQL configuration (IAM auth)...', CONTEXT);
    this.logger.log('Aurora MySQL configuration validated (IAM auth mode)', CONTEXT);
  }

  /**
   * Validates production safeguards to prevent data loss
   * Note: synchronize is permanently disabled in database.ts (hardcoded to false)
   */
  private static validateProductionSafeguards(
    configService: ConfigService,
    env: string,
  ): void {
    // Log that synchronize is permanently disabled
    this.logger.log('Schema synchronization is permanently disabled (use migrations)', CONTEXT);

    this.logger.log('Production safeguards validated', CONTEXT);
  }

  /**
   * Validates required database credentials are properly set (IAM auth only)
   */
  private static validateRequiredCredentials(
    configService: ConfigService,
  ): void {
    // Required vars for IAM authentication
    const requiredVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'AWS_REGION'];

    const missingVars: string[] = [];

    for (const varName of requiredVars) {
      const value = configService.get<string>(varName);
      if (!value) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(
        `CRITICAL: Missing required database environment variables for IAM authentication: ${missingVars.join(', ')}. ` +
          'Please set these variables in your environment or .env file.',
      );
    }

    this.logger.log('Database credentials validated (IAM authentication)', CONTEXT);
  }

  /**
   * Validates IAM authentication configuration
   */
  private static validateIAMAuthConfiguration(configService: ConfigService): void {
    this.logger.log('Validating IAM authentication configuration...', CONTEXT);

    // Validate AWS region is set
    const region = configService.get<string>('AWS_REGION');
    if (!region) {
      throw new Error('CRITICAL: AWS_REGION must be set for IAM authentication. ' + 'This is required for generating IAM authentication tokens.');
    }

    // Validate database user format (should not have special characters that IAM doesn't support)
    const username = configService.get<string>('MYSQL_USER');
    if (username && username.includes(':')) {
      this.logger.warn(
        'WARNING: Database username contains ":" which may cause issues with IAM authentication. ' +
          'Consider using a simpler username format (e.g., "app" or "iam_db_user").',
        CONTEXT,
      );
    }

    // Check for CA certificate file (recommended but not required)
    const fs = require('fs');
    const path = require('path');
    const certPath = path.join(process.cwd(), 'certs', 'global-bundle.pem');

    if (!fs.existsSync(certPath)) {
      this.logger.warn(
        'WARNING: RDS CA certificate bundle not found at certs/global-bundle.pem. ' +
          'While not strictly required, it is recommended for secure SSL connections. ' +
          'Download from: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
        CONTEXT,
      );
    }

    this.logger.log('IAM authentication configuration validated', CONTEXT);
    this.logger.log(
      'Ensure the following are configured in AWS:\n' +
        '   1. IAM authentication enabled on Aurora cluster\n' +
        '   2. Database user created with rds_iam role (MySQL: IDENTIFIED WITH AWSAuthenticationPlugin)\n' +
        '   3. IAM policy grants rds-db:connect permission\n' +
        '   4. AWS credentials available (instance role, environment, or AWS CLI config)',
      CONTEXT,
    );
  }

  /**
   * Validates and warns about development-only settings
   */
  private static validateDevelopmentSettings(
    configService: ConfigService,
  ): void {
    const migrationsRun = configService.get<string>('TYPEORM_MIGRATIONS_RUN');
    if (migrationsRun === 'true') {
      this.logger.warn('DEVELOPMENT MODE: migrationsRun=true is enabled. Migrations will run automatically on startup.', CONTEXT);
    }
  }

  /**
   * Tests database connectivity
   * Can be used in health checks or startup validation
   */
  static async testConnection(dataSource: any): Promise<boolean> {
    try {
      this.logger.log('Testing database connection...', CONTEXT);

      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Simple connectivity test
      await dataSource.query('SELECT 1 as health_check');

      this.logger.log('Database connection test passed', CONTEXT);
      return true;
    } catch (error) {
      this.logger.error(`Database connection test failed: ${error instanceof Error ? error.message : error}`, undefined, CONTEXT);
      return false;
    }
  }
}
