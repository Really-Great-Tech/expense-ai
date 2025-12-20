import { registerAs } from '@nestjs/config';

/**
 * Centralized Application Configuration
 *
 * This file provides ALL environment variable defaults in one place.
 * All configuration access should go through this typed config.
 *
 * Usage:
 *   - In NestJS services: this.configService.get('app.database.host')
 *   - Outside DI: import appConfig from './app.config'; const config = appConfig();
 *
 * Configuration Categories:
 *   - REQUIRED IN PRODUCTION: Must be set in production (no safe defaults)
 *   - OPTIONAL: Have sensible defaults for all environments
 *   - DEVELOPMENT: Have dev-friendly defaults, should be overridden in production
 */

export interface AppConfigType {
  // Application
  port: number;
  nodeEnv: string;
  isProduction: boolean;

  // Database
  database: {
    auroraMySQL: boolean;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
    iamAuthEnabled: boolean;
    connectionLimit: number;
    queueLimit: number;
  };

  // Redis
  redis: {
    host: string;
    port: number;
    password: string | undefined;
    db: number;
    mode: 'local' | 'managed';
    tlsEnabled: boolean;
    clusterEnabled: boolean;
  };

  // AWS
  aws: {
    region: string;
  };

  // Storage
  storage: {
    type: 'local' | 's3';
    uploadPath: string;
    s3BucketName: string | undefined;
  };

  // Bedrock/LLM
  bedrock: {
    model: string;
    usingApplicationProfile: boolean;
    citationModel: string;
    judgeModel1: string;
    judgeModel2: string;
    judgeModel3: string;
  };

  // Workers
  workers: {
    concurrency: number;
    maxRetryAttempts: number;
    jobTimeout: number;
  };

  // Throttling
  throttle: {
    ttl: number;
    limit: number;
  };

  // Request limits
  requestLimits: {
    bodyLimit: string;
    urlEncodedLimit: string;
  };

  // Document processing
  documentReader: string;

  // Security
  security: {
    privateKey: string | undefined;
    publicKey: string | undefined;
  };

  // TypeORM
  typeorm: {
    migrationsRun: boolean;
    logging: string;
  };

  // CORS
  cors: {
    allowedOrigins: string | boolean;
  };
}

export default registerAs('app', (): AppConfigType => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    // ==========================================================================
    // APPLICATION
    // ==========================================================================
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv,
    isProduction: nodeEnv === 'production',

    // ==========================================================================
    // DATABASE (MySQL/Aurora)
    // Supported modes:
    // - Local MySQL (AURORA_MYSQL !== 'true'): localhost only, password auth
    // - Aurora MySQL (AURORA_MYSQL === 'true'): IAM auth required, no password
    // ==========================================================================
    database: {
      auroraMySQL: process.env.AURORA_MYSQL === 'true',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'expense_ai',
      ssl: process.env.MYSQL_SSL === 'true',
      iamAuthEnabled: process.env.MYSQL_IAM_AUTH_ENABLED === 'true',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
      queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '100', 10),
    },

    // ==========================================================================
    // REDIS
    // ==========================================================================
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      mode: (process.env.REDIS_MODE || 'local') as 'local' | 'managed',
      tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
      clusterEnabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
    },

    // ==========================================================================
    // AWS
    // ==========================================================================
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
    },

    // ==========================================================================
    // STORAGE
    // ==========================================================================
    storage: {
      type: (process.env.STORAGE_TYPE || 'local') as 'local' | 's3',
      uploadPath: process.env.UPLOAD_PATH || './uploads',
      s3BucketName: process.env.S3_BUCKET_NAME,
    },

    // ==========================================================================
    // BEDROCK/LLM
    // ==========================================================================
    bedrock: {
      model: process.env.BEDROCK_MODEL || 'us.amazon.nova-pro-v1:0',
      usingApplicationProfile: process.env.USING_APPLICATION_PROFILE === 'true',
      citationModel: process.env.CITATION_MODEL || 'us.amazon.nova-micro-v1:0',
      judgeModel1: process.env.BEDROCK_JUDGE_MODEL_1 || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      judgeModel2: process.env.BEDROCK_JUDGE_MODEL_2 || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      judgeModel3: process.env.BEDROCK_JUDGE_MODEL_3 || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    },

    // ==========================================================================
    // WORKERS
    // ==========================================================================
    workers: {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
      maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
      jobTimeout: parseInt(process.env.JOB_TIMEOUT || '300000', 10),
    },

    // ==========================================================================
    // THROTTLING
    // ==========================================================================
    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    },

    // ==========================================================================
    // REQUEST LIMITS
    // ==========================================================================
    requestLimits: {
      bodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
      urlEncodedLimit: process.env.URL_ENCODED_LIMIT || '1mb',
    },

    // ==========================================================================
    // DOCUMENT PROCESSING
    // ==========================================================================
    documentReader: process.env.DOCUMENT_READER || 'textract',

    // ==========================================================================
    // SECURITY
    // ==========================================================================
    security: {
      privateKey: process.env.PRIVATE_KEY,
      publicKey: process.env.PUBLIC_KEY,
    },

    // ==========================================================================
    // TYPEORM
    // ==========================================================================
    typeorm: {
      migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
      logging: process.env.TYPEORM_LOGGING || '',
    },

    // ==========================================================================
    // CORS
    // ==========================================================================
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS || false,
    },
  };
});

/**
 * Get config outside of NestJS DI context
 * Useful for database.ts and other files that run before DI is initialized
 */
export function getAppConfig(): AppConfigType {
  const configFn = require('./app.config').default;
  return configFn();
}
