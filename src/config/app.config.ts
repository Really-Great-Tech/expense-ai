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

  // Database (Aurora MySQL or local)
  database: {
    mode: 'local' | 'iam'; // 'local' for local MySQL, 'iam' for Aurora IAM auth
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

  // Redis (Managed/ElastiCache only)
  redis: {
    host: string;
    port: number;
  };

  // AWS
  aws: {
    region: string;
  };

  // Storage (S3 only)
  storage: {
    s3BucketName: string | undefined;
  };

  // Bedrock/LLM - Application Inference Profiles
  bedrock: {
    novaMicroArn: string;
    novaProArn: string;
    sonnet4Arn: string;
    sonnet45Arn: string;
  };

  // Workers
  workers: {
    concurrency: number;
    splitterConcurrency: number;
    maxRetryAttempts: number;
    backoffDelayMs: number;
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

  // Textract Configuration
  textract: {
    useAsync: boolean;
    tempBucket: string | undefined;
    asyncTimeoutMs: number;
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

  // Validation (Judge configuration)
  validation: {
    judgeCount: number;
    judgeTemperatures: number[];
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
    // DATABASE (Aurora MySQL with IAM auth OR local MySQL)
    // ==========================================================================
    database: {
      mode: (process.env.DB_MODE as 'local' | 'iam') || 'iam',
      host: process.env.MYSQL_HOST || '',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || '',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || '',
      ssl: process.env.DB_MODE === 'local' ? false : true,
      iamAuthEnabled: process.env.DB_MODE !== 'local',
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
      queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '100', 10),
    },

    // ==========================================================================
    // REDIS (Managed/ElastiCache only - no localhost support)
    // ==========================================================================
    redis: {
      host: process.env.REDIS_HOST || '',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },

    // ==========================================================================
    // AWS
    // ==========================================================================
    aws: {
      region: process.env.AWS_REGION || 'eu-west-1',
    },

    // ==========================================================================
    // STORAGE (S3 only - no local storage support)
    // ==========================================================================
    storage: {
      s3BucketName: process.env.S3_BUCKET_NAME,
    },

    // ==========================================================================
    // BEDROCK/LLM - Application Inference Profile ARNs
    // ==========================================================================
    bedrock: {
      novaMicroArn: process.env.BEDROCK_NOVA_MICRO_ARN || '',
      novaProArn: process.env.BEDROCK_NOVA_PRO_ARN || '',
      sonnet4Arn: process.env.BEDROCK_SONNET_4_ARN || '',
      sonnet45Arn: process.env.BEDROCK_SONNET_4_5_ARN || '',
    },

    // ==========================================================================
    // WORKERS
    // ==========================================================================
    workers: {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '50', 10),
      splitterConcurrency: parseInt(process.env.SPLITTER_CONCURRENCY || '50', 10),
      maxRetryAttempts: parseInt(process.env.WORKER_MAX_RETRY_ATTEMPTS || '4', 10),
      backoffDelayMs: parseInt(process.env.WORKER_BACKOFF_DELAY_MS || '35000', 10), // 35s > circuit breaker recovery (30s)
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
    // TEXTRACT CONFIGURATION
    // ==========================================================================
    textract: {
      useAsync: true,
      tempBucket: process.env.S3_BUCKET_NAME,
      asyncTimeoutMs: parseInt(process.env.TEXTRACT_ASYNC_TIMEOUT_MS || '300000', 10), // 5 min default
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

    // ==========================================================================
    // VALIDATION (Judge configuration)
    // ==========================================================================
    validation: {
      judgeCount: parseInt(process.env.VALIDATION_JUDGE_COUNT || '1', 10),
      judgeTemperatures: (process.env.VALIDATION_JUDGE_TEMPERATURES || '0.3,0.7,0.5').split(',').map((t) => parseFloat(t.trim())),
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
