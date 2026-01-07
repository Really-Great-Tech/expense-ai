import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { RDSIAMAuthManager } from './database-iam-auth';
import { getAppConfig } from './app.config';

// Load environment variables from .env file
dotenv.config();

// Get centralized config
const config = getAppConfig();

// JSON logger for database config (before NestJS logger is available)
const log = (message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'log',
    context: 'TypeORMConfig',
    message,
    ...(data && { data }),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(logEntry));
};

const isProduction = config.isProduction;

/**
 * Robust path resolution for TypeORM entities and migrations
 * Supports all scenarios: local dev, watch mode, CLI operations, and production
 *
 * Strategy:
 * - Check if dist folder exists with compiled migrations
 * - If yes: use dist paths (production/post-build scenario)
 * - If no: use src paths (development with ts-node scenario)
 *
 * This prevents duplicate detection while supporting both environments
 */
const cwd = process.cwd();
const distSrcMigrations = join(cwd, 'dist', 'src', 'migrations');
const distMigrations = join(cwd, 'dist', 'migrations');
const srcMigrations = join(cwd, 'src', 'migrations');

// Check multiple possible locations for compiled migrations
const distMigrationsExist = existsSync(distSrcMigrations) || existsSync(distMigrations);


// Use dist if it exists and has migrations, otherwise use src
// Include both possible dist locations for maximum compatibility
const entityPaths = distMigrationsExist
  ? ['dist/src/**/*.entity.js', 'dist/**/*.entity.js']
  : ['src/**/*.entity.ts'];

const migrationPaths = distMigrationsExist
  ? ['dist/src/migrations/*.js', 'dist/migrations/*.js']
  : ['src/migrations/*.ts'];

log('Entity paths configured', { paths: entityPaths });
log('Migration paths configured', { paths: migrationPaths });

/**
 * SSL Configuration for Aurora MySQL
 *
 * IAM authentication requires SSL/TLS - only enabled for IAM mode.
 */
const getSslConfig = () => {
  // Local mode: no SSL
  if (config.database.mode === 'local') {
    log('Local mode: SSL disabled');
    return false;
  }

  // Path to RDS CA certificate bundle
  const certPath = join(process.cwd(), 'certs', 'global-bundle.pem');
  const certPathAlt = join(__dirname, '..', '..', 'certs', 'global-bundle.pem');

  let ca: string | undefined;

  // Try to load certificate if it exists
  if (existsSync(certPath)) {
    ca = readFileSync(certPath, 'utf8');
    log('Loaded RDS CA certificate', { path: certPath });
  } else if (existsSync(certPathAlt)) {
    ca = readFileSync(certPathAlt, 'utf8');
    log('Loaded RDS CA certificate', { path: certPathAlt });
  } else {
    // Certificate not found - will fall back to system CA certificates
    log('RDS CA certificate not found, using system CA certificates', {
      checkedPaths: [certPath, certPathAlt],
      downloadUrl: 'https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
    });
  }

  return {
    rejectUnauthorized: isProduction, // Always enforce SSL validation in production
    ca, // CA certificate bundle (optional - falls back to system CA if not provided)
  };
};

/**
 * Get IAM auth configuration for connection pool
 *
 * For Aurora MySQL IAM authentication:
 * - The database user must be created with AWSAuthenticationPlugin
 * - mysql2 driver uses authPlugins to handle mysql_clear_password
 * - Token is generated via AWS SDK RDS Signer
 *
 * For local MySQL: returns empty config (uses password auth)
 */
const getIAMAuthConfig = () => {
  // Local mode: no IAM auth, use password
  if (config.database.mode === 'local') {
    log('Local mode: using password authentication');
    return {};
  }

  const hostname = config.database.host;
  const port = config.database.port;
  const username = config.database.user;
  const region = config.aws.region;

  if (!hostname || !username) {
    throw new Error('Missing required IAM authentication configuration: MYSQL_HOST and MYSQL_USER must be set.');
  }

  log('Configuring IAM authentication', { hostname, port, username, region });

  return {
    // mysql2 authPlugins for IAM authentication
    authPlugins: {
      // This plugin is called when server requests mysql_clear_password auth
      mysql_clear_password: () => () => {
        log('mysql_clear_password plugin invoked, generating IAM token');
        return RDSIAMAuthManager.getAuthToken({
          hostname,
          port,
          username,
          region,
        }).then((token) => {
          log('IAM token generated successfully');
          // mysql_clear_password requires null-terminated string as Buffer
          return Buffer.from(token + '\0');
        });
      },
    },
  };
};

// MySQL configuration (IAM auth or local password auth)
log('Database mode', { mode: config.database.mode });

const baseDBConfig: DataSourceOptions = {
  type: 'mysql' as const,
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  // Password: empty for IAM auth, from env for local
  password: config.database.mode === 'local' ? config.database.password : '',
  database: config.database.database,

  // Dynamically resolved paths based on environment
  entities: entityPaths,
  migrations: migrationPaths,

  // Explicitly name migration table for namespace isolation
  migrationsTableName: 'expense_ai_migrations',

  // CRITICAL: Synchronize is ALWAYS disabled - use migrations instead
  // This prevents accidental schema changes that could cause data loss
  synchronize: false,

  // DISABLED: Auto-migration causes race conditions in multi-instance deployments
  // Migrations are run via Docker entrypoint script (TYPEORM_MIGRATIONS_RUN=true)
  // or manually via: npx typeorm migration:run -d dist/src/config/database.js
  migrationsRun: true,

  // Enable transaction per migration for rollback safety
  migrationsTransactionMode: 'each' as const,

  // SSL Configuration for Aurora MySQL
  // IAM authentication requires SSL/TLS
  ssl: getSslConfig(),

  // Aurora MySQL optimized settings
  timezone: 'Z', // Use UTC timezone
  charset: 'utf8mb4',

  // Connection timeout
  connectTimeout: 60000, // 60 seconds

  // Connection pool settings optimized for Aurora
  extra: {
    connectionLimit: config.database.connectionLimit,
    queueLimit: config.database.queueLimit,

    // IAM auth plugin
    ...getIAMAuthConfig(),

    // Aurora MySQL specific optimizations
    multipleStatements: false,
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
  },

  // Slow query logging threshold
  maxQueryExecutionTime: 60000,

  // Enhanced logging for migrations - includes schema and migration logs
  logging:
    config.typeorm.logging === 'all'
      ? 'all'
      : ['error', 'warn', 'schema', 'migration'],
  logger: 'advanced-console',
};

// Export base config for application use
export const dataSourceOptions: DataSourceOptions = baseDBConfig;

// Create and export DataSource instance for CLI operations
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
