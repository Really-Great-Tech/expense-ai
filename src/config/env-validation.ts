import { Logger } from '@nestjs/common';

const logger = new Logger('EnvironmentValidation');

/**
 * Environment Variable Requirement Definition
 */
interface EnvRequirement {
  name: string;
  description: string;
  condition?: () => boolean;
}

/**
 * Variables required in production (no safe defaults)
 */
const REQUIRED_IN_PRODUCTION: EnvRequirement[] = [
  { name: 'MYSQL_HOST', description: 'Aurora MySQL host' },
  { name: 'MYSQL_USER', description: 'Database username' },
  { name: 'MYSQL_DATABASE', description: 'Database name' },
  { name: 'REDIS_HOST', description: 'ElastiCache Redis host' },
  { name: 'S3_BUCKET_NAME', description: 'S3 bucket for file storage' },
];

/**
 * Additional required variables for IAM authentication
 * (Aurora MySQL with IAM auth only - no password auth supported)
 */
const CONDITIONAL_REQUIREMENTS: EnvRequirement[] = [
  {
    name: 'AWS_REGION',
    description: 'AWS region (required for IAM auth)',
    condition: () => true, // Always required - IAM auth only
  },
];

/**
 * Variables that should be warned about if missing (but not required)
 */
const RECOMMENDED_VARIABLES: EnvRequirement[] = [
  { name: 'AWS_REGION', description: 'AWS region (defaults to eu-west-1)' },
  { name: 'WORKER_CONCURRENCY', description: 'Worker concurrency (defaults to 5)' },
];

/**
 * Validate all required environment variables at application startup
 *
 * Behavior:
 * - In PRODUCTION: Throws error if any required vars are missing
 * - In DEVELOPMENT: Logs warnings but allows app to start with defaults
 *
 * @throws Error in production when required variables are missing
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];

  // Check required variables for production
  for (const { name, description } of REQUIRED_IN_PRODUCTION) {
    if (!process.env[name]) {
      missingRequired.push(`  - ${name} (${description})`);
    }
  }

  // Check conditional requirements
  for (const { name, description, condition } of CONDITIONAL_REQUIREMENTS) {
    if (condition && condition() && !process.env[name]) {
      missingRequired.push(`  - ${name} (${description})`);
    }
  }

  // Check recommended variables
  for (const { name, description } of RECOMMENDED_VARIABLES) {
    if (!process.env[name]) {
      missingRecommended.push(`  - ${name} (${description})`);
    }
  }

  // Handle missing required variables
  if (missingRequired.length > 0) {
    const message =
      `Missing required environment variables for production:\n` +
      missingRequired.join('\n') +
      `\n\nPlease set these variables or check your deployment configuration.`;

    if (isProduction) {
      logger.error(`ERROR: ${message}`);
      throw new Error(message);
    } else {
      logger.warn(
        `WARNING (development mode - using defaults):\n${message}\n\n` +
          `The application will start with development defaults. ` +
          `These variables MUST be set in production.`,
      );
    }
  }

  // Warn about missing recommended variables
  if (missingRecommended.length > 0 && !isProduction) {
    logger.log(
      `Missing recommended variables (using defaults):\n` +
        missingRecommended.join('\n'),
    );
  }

  // Log successful validation
  const mode = isProduction ? 'production' : 'development';
  logger.log(`Environment validation passed (${mode} mode)`);
}

/**
 * Get a summary of all configuration with their current values
 * Useful for debugging configuration issues
 *
 * @param redactSecrets - Whether to redact sensitive values (default: true)
 */
export function getConfigSummary(redactSecrets = true): Record<string, string | undefined> {
  const sensitiveKeys = ['AWS_SECRET_ACCESS_KEY'];

  const allVars = [
    // Application
    'NODE_ENV',
    'PORT',
    // Database (Aurora MySQL - IAM auth only)
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_USER',
    'MYSQL_DATABASE',
    // Redis (ElastiCache)
    'REDIS_HOST',
    // AWS
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    // Storage (S3)
    'S3_BUCKET_NAME',
    // Bedrock
    'BEDROCK_MODEL',
    'USING_APPLICATION_PROFILE',
    // Workers
    'WORKER_CONCURRENCY',
    'MAX_RETRY_ATTEMPTS',
    'JOB_TIMEOUT',
  ];

  const summary: Record<string, string | undefined> = {};

  for (const key of allVars) {
    const value = process.env[key];
    if (redactSecrets && sensitiveKeys.includes(key) && value) {
      summary[key] = '[REDACTED]';
    } else {
      summary[key] = value || '[NOT SET]';
    }
  }

  return summary;
}

/**
 * Log configuration summary for debugging
 */
export function logConfigSummary(): void {
  const summary = getConfigSummary(true);
  logger.log('Configuration Summary:');
  for (const [key, value] of Object.entries(summary)) {
    logger.log(`  ${key}: ${value}`);
  }
}
