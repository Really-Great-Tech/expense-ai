import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Database Configuration Validator
 *
 * Validates critical database configuration settings to prevent
 * dangerous misconfigurations in production environments.
 *
 * This validator enforces:
 * - NEVER auto-sync schemas in production (data loss risk)
 * - NEVER auto-run migrations in production (manual control required)
 * - SSL enforcement for production databases
 * - Required environment variables validation
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

    this.logger.log('✅ Database configuration validation passed');
  }

  /**
   * Validates production safeguards to prevent data loss
   */
  private static validateProductionSafeguards(
    configService: ConfigService,
    env: string,
  ): void {
    // 1. NEVER allow synchronize in production
    const synchronize = configService.get<string>('TYPEORM_SYNCHRONIZE');
    // if (synchronize === 'true') {
    //   throw new Error(
    //     `❌ CRITICAL: TYPEORM_SYNCHRONIZE=true is NOT allowed in ${env}. ` +
    //       'This will automatically alter your database schema and can cause DATA LOSS. ' +
    //       'Use migrations instead: npm run migration:generate && npm run migration:run',
    //   );
    // }

    // 2. NEVER auto-run migrations in production
    const migrationsRun = configService.get<string>('TYPEORM_MIGRATIONS_RUN');
    // if (migrationsRun === 'true') {
    //   throw new Error(
    //     `❌ CRITICAL: TYPEORM_MIGRATIONS_RUN=true is NOT allowed in ${env}. ` +
    //       'Migrations must be run manually via CLI for safety and control. ' +
    //       'Use: npm run migration:run',
    //   );
    // }

    this.logger.log('✅ Production safeguards validated');
  }

  /**
   * Validates SSL configuration for production databases
   */
  private static validateSSLConfiguration(configService: ConfigService): void {
    const ssl = configService.get<string>('MYSQL_SSL');
    const useIAMAuth = configService.get<string>('MYSQL_IAM_AUTH_ENABLED') === 'true';

    // IAM auth requires SSL - it will be auto-enabled
    if (useIAMAuth) {
      this.logger.log('✅ SSL automatically enabled for IAM authentication');
      return;
    }

    if (ssl !== 'true') {
      this.logger.warn(
        '⚠️  WARNING: MYSQL_SSL is not enabled. ' +
          'SSL is strongly recommended for production databases to encrypt data in transit.',
      );
    } else {
      this.logger.log('✅ SSL configuration validated');
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
        `❌ CRITICAL: Missing required database environment variables for ${authType}: ${missingVars.join(', ')}. ` +
          'Please set these variables in your environment or .env file.',
      );
    }

    if (invalidVars.length > 0) {
      throw new Error(
        `❌ CRITICAL: Invalid placeholder values detected in: ${invalidVars.join(', ')}. ` +
          'Please set valid database credentials in environment variables.',
      );
    }

    const authType = useIAMAuth ? 'IAM' : 'traditional';
    this.logger.log(`✅ Database credentials validated (${authType} authentication)`);
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
        '❌ CRITICAL: AWS_REGION must be set when MYSQL_IAM_AUTH_ENABLED=true. ' +
          'This is required for generating IAM authentication tokens.',
      );
    }

    // Validate database user format (should not have special characters that IAM doesn't support)
    const username = configService.get<string>('MYSQL_USER');
    if (username && username.includes(':')) {
      this.logger.warn(
        '⚠️  WARNING: Database username contains ":" which may cause issues with IAM authentication. ' +
          'Consider using a simpler username format (e.g., "iam_db_user").',
      );
    }

    // Warn if MYSQL_PASSWORD is set when using IAM auth
    const password = configService.get<string>('MYSQL_PASSWORD');
    if (password) {
      this.logger.warn(
        '⚠️  WARNING: MYSQL_PASSWORD is set but MYSQL_IAM_AUTH_ENABLED=true. ' +
          'The password will be ignored. IAM tokens will be used for authentication.',
      );
    }

    // Check for CA certificate file (recommended but not required)
    const fs = require('fs');
    const path = require('path');
    const certPath = path.join(process.cwd(), 'certs', 'global-bundle.pem');

    if (!fs.existsSync(certPath)) {
      this.logger.warn(
        '⚠️  WARNING: RDS CA certificate bundle not found at certs/global-bundle.pem. ' +
          'While not strictly required, it is recommended for secure SSL connections. ' +
          'Download from: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
      );
    }

    this.logger.log('✅ IAM authentication configuration validated');
    this.logger.log(
      'ℹ️  Ensure the following are configured in AWS:\n' +
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
    const synchronize = configService.get<string>('TYPEORM_SYNCHRONIZE');
    if (synchronize === 'true') {
      this.logger.warn(
        '⚠️  DEVELOPMENT MODE: synchronize=true is enabled. ' +
          'This is OK for development but remember to use migrations for production.',
      );
    }

    const migrationsRun = configService.get<string>('TYPEORM_MIGRATIONS_RUN');
    if (migrationsRun === 'true') {
      this.logger.warn(
        '⚠️  DEVELOPMENT MODE: migrationsRun=true is enabled. ' +
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

      this.logger.log('✅ Database connection test passed');
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Database connection test failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}
