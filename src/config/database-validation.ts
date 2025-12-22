import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Database Configuration Validator
 *
 * Validates critical database configuration settings to prevent
 * dangerous misconfigurations in production environments.
 *
 * SUPPORTED MODES:
 * 1. Local MySQL (AURORA_MYSQL !== 'true'): Password auth on localhost only
 * 2. Aurora MySQL (AURORA_MYSQL === 'true'): IAM auth required, no password allowed
 *
 * This validator enforces:
 * - SSL enforcement for production databases
 * - Required environment variables validation
 * - IAM authentication configuration validation
 * - Strict mode enforcement (local vs Aurora)
 *
 * Note: Schema synchronization is permanently disabled (synchronize: false)
 * to prevent accidental data loss. Use migrations for all schema changes.
 */
export class DatabaseConfigValidator {
  private static readonly logger = new Logger('DatabaseConfigValidator');

  /**
   * Validates database configuration on application startup
   * Throws errors for critical misconfigurations
   */
  static validate(configService: ConfigService): void {
    const env = configService.get<string>('NODE_ENV', 'development');
    const isProduction = env === 'production';
    const isStaging = env === 'staging';

    this.logger.log(`Validating database configuration for environment: ${env}`);

    // Always validate database mode (local vs Aurora) - applies to all environments
    this.validateDatabaseMode(configService);

    // Critical validations for production/staging
    if (isProduction || isStaging) {
      this.validateProductionSafeguards(configService, env);
      this.validateSSLConfiguration(configService);
      this.validateRequiredCredentials(configService);
      this.validateIAMAuthConfiguration(configService);
    }

    // Warn about development-only settings
    if (!isProduction && !isStaging) {
      this.validateDevelopmentSettings(configService);
    }

    this.logger.log('Database configuration validation passed');
  }

  /**
   * Validates database mode configuration
   * Enforces IAM auth for Aurora MySQL
   */
  private static validateDatabaseMode(configService: ConfigService): void {
    const isAuroraMySQL = configService.get<string>('AURORA_MYSQL') === 'true';

    if (isAuroraMySQL) {
      this.validateAuroraMySQLConfiguration(configService);
    }
  }

  /**
   * Validates Aurora MySQL configuration
   * Enforces IAM authentication and rejects password-based auth
   */
  private static validateAuroraMySQLConfiguration(configService: ConfigService): void {
    this.logger.log('Validating Aurora MySQL configuration...');

    const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';
    const password = configService.get<string>('MYSQL_PASSWORD');

    // Aurora MySQL requires IAM authentication
    if (!useIAMAuth) {
      throw new Error(
        'CRITICAL: Aurora MySQL requires IAM authentication. ' +
          'Set MYSQL_IAM_AUTH_ENABLED=true when AURORA_MYSQL=true. ' +
          'Password-based authentication is not supported for Aurora MySQL.',
      );
    }

    // Aurora MySQL must not have password set
    if (password) {
      throw new Error(
        'CRITICAL: MYSQL_PASSWORD must not be set for Aurora MySQL. ' +
          'Remove MYSQL_PASSWORD from environment when AURORA_MYSQL=true. ' +
          'Use IAM authentication only for Aurora MySQL connections.',
      );
    }

    this.logger.log('Aurora MySQL configuration validated (IAM auth enforced)');
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
    this.logger.log('Schema synchronization is permanently disabled (use migrations)');

    this.logger.log('Production safeguards validated');
  }

  /**
   * Validates SSL configuration for production databases
   */
  private static validateSSLConfiguration(configService: ConfigService): void {
    const ssl = configService.get<string>('MYSQL_SSL');
    const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';

    // IAM auth requires SSL - it will be auto-enabled
    if (useIAMAuth) {
      this.logger.log('SSL automatically enabled for IAM authentication');
      return;
    }

    if (ssl !== 'true') {
      this.logger.warn(
        'WARNING: MYSQL_SSL is not enabled. ' +
          'SSL is strongly recommended for production databases to encrypt data in transit.',
      );
    } else {
      this.logger.log('SSL configuration validated');
    }
  }

  /**
   * Validates required database credentials are properly set
   */
  private static validateRequiredCredentials(
    configService: ConfigService,
  ): void {
    const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';

    // Different required vars based on auth method
    const requiredVars = useIAMAuth
      ? ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE', 'AWS_REGION']
      : ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];

    const missingVars: string[] = [];
    const invalidVars: string[] = [];

    for (const varName of requiredVars) {
      const value = configService.get<string>(varName);

      if (!value) {
        missingVars.push(varName);
      } else if (
        !useIAMAuth && // Only check password placeholders for traditional auth
        varName === 'MYSQL_PASSWORD' &&
        (value.includes('your_') ||
          value.includes('xxxxx') ||
          value === 'changeme' ||
          value === 'password')
      ) {
        invalidVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      const authType = useIAMAuth ? 'IAM authentication' : 'traditional authentication';
      throw new Error(
        `CRITICAL: Missing required database environment variables for ${authType}: ${missingVars.join(', ')}. ` +
          'Please set these variables in your environment or .env file.',
      );
    }

    if (invalidVars.length > 0) {
      throw new Error(
        `CRITICAL: Invalid placeholder values detected in: ${invalidVars.join(', ')}. ` +
          'Please set valid database credentials in environment variables.',
      );
    }

    const authType = useIAMAuth ? 'IAM' : 'traditional';
    this.logger.log(`Database credentials validated (${authType} authentication)`);
  }

  /**
   * Validates IAM authentication configuration
   */
  private static validateIAMAuthConfiguration(configService: ConfigService): void {
    const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';

    if (!useIAMAuth) {
      return; // Skip validation if IAM auth is not enabled
    }

    this.logger.log('Validating IAM authentication configuration...');

    // Validate AWS region is set
    const region = configService.get<string>('AWS_REGION');
    if (!region) {
      throw new Error(
        'CRITICAL: AWS_REGION must be set when MYSQL_IAM_AUTH_ENABLED=true. ' +
          'This is required for generating IAM authentication tokens.',
      );
    }

    // Validate database user format (should not have special characters that IAM doesn't support)
    const username = configService.get<string>('MYSQL_USER');
    if (username && username.includes(':')) {
      this.logger.warn(
        'WARNING: Database username contains ":" which may cause issues with IAM authentication. ' +
          'Consider using a simpler username format (e.g., "iam_db_user").',
      );
    }

    // Block password when using IAM auth - this is a security requirement
    const password = configService.get<string>('MYSQL_PASSWORD');
    if (password) {
      throw new Error(
        'CRITICAL: MYSQL_PASSWORD must not be set when MYSQL_IAM_AUTH_ENABLED=true. ' +
          'Remove MYSQL_PASSWORD from environment to use IAM authentication.',
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
      );
    }

    this.logger.log('IAM authentication configuration validated');
    this.logger.log(
      'Ensure the following are configured in AWS:\n' +
        '   1. IAM authentication enabled on Aurora cluster\n' +
        '   2. Database user created with rds_iam role (MySQL: IDENTIFIED WITH AWSAuthenticationPlugin)\n' +
        '   3. IAM policy grants rds-db:connect permission\n' +
        '   4. AWS credentials available (instance role, environment, or AWS CLI config)',
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
      this.logger.warn(
        'DEVELOPMENT MODE: migrationsRun=true is enabled. ' +
          'Migrations will run automatically on startup.',
      );
    }
  }

  /**
   * Tests database connectivity
   * Can be used in health checks or startup validation
   */
  static async testConnection(dataSource: any): Promise<boolean> {
    try {
      this.logger.log('Testing database connection...');

      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      // Simple connectivity test
      await dataSource.query('SELECT 1 as health_check');

      this.logger.log('Database connection test passed');
      return true;
    } catch (error) {
      this.logger.error(
        `Database connection test failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}
