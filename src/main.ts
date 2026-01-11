import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './tools/logger/logger.service';
import { useContainer } from 'class-validator';
import { MySqlHealthIndicator } from './health/indicators/mysql.health';
import { RedisHealthIndicator } from './health/indicators/redis.health';
import { validateEnvironment } from './config/env-validation';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';

const logger = new LoggerService();

const BOOTSTRAP_CONTEXT = 'Bootstrap';

function gracefulExit(error: Error | string, exitCode = 1): void {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(`Fatal error: ${message}`, stack, BOOTSTRAP_CONTEXT);
  logger.error('Application failed to start - shutting down', undefined, BOOTSTRAP_CONTEXT);

  setTimeout(() => process.exit(exitCode), 100);
}

process.on('uncaughtException', (error) => {
  gracefulExit(error);
});

process.on('unhandledRejection', (reason) => {
  // Log unhandled rejections but don't exit - they are often non-fatal (e.g., deadlocks in background jobs)
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(`Unhandled rejection: ${error.message}`, error.stack, BOOTSTRAP_CONTEXT);
});

async function bootstrap() {
  // Validate environment variables early, before creating the NestJS app
  logger.log('Validating environment configuration...', BOOTSTRAP_CONTEXT);
  validateEnvironment();

  try {
    logger.log('Creating NestJS application...', BOOTSTRAP_CONTEXT);
    const app = await NestFactory.create(AppModule, {
      bufferLogs: false,
      logger, // Use JSON logger from the start to avoid [Nest] console logs
    });
    logger.log('NestJS application created successfully', BOOTSTRAP_CONTEXT);
    const configService = app.get(ConfigService);

    // Enable class-validator to use NestJS's DI container for custom validators
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // Get typed app config
    const appConfig = configService.get('app')!;

    // Request body size limits - prevent large payload attacks
    const bodyLimit = appConfig.requestLimits.bodyLimit;
    const urlEncodedLimit = appConfig.requestLimits.urlEncodedLimit;

    app.use(express.json({ limit: bodyLimit }));
    app.use(express.urlencoded({ limit: urlEncodedLimit, extended: true }));
    app.use(express.raw({ limit: bodyLimit, type: 'application/octet-stream' }));

    logger.log(`Request body size limits configured: JSON=${bodyLimit}, URL-encoded=${urlEncodedLimit}`, BOOTSTRAP_CONTEXT);

    // Request size monitoring and limit middleware (50MB max)
    const MAX_REQUEST_SIZE_MB = 50;
    const MAX_REQUEST_SIZE_BYTES = MAX_REQUEST_SIZE_MB * 1024 * 1024;

    app.use((req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength, 10);
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

        // // Reject requests exceeding 50MB
        // if (sizeInBytes > MAX_REQUEST_SIZE_BYTES) {
        //   logger.error(`Request rejected: ${sizeInMB}MB exceeds ${MAX_REQUEST_SIZE_MB}MB limit on ${req.method} ${req.path}`, BOOTSTRAP_CONTEXT);
        //   return res.status(413).json({
        //     statusCode: 413,
        //     message: `Request size (${sizeInMB}MB) exceeds maximum allowed size of ${MAX_REQUEST_SIZE_MB}MB`,
        //     error: 'Payload Too Large',
        //   });
        // }

        // // Log large requests for monitoring (> 100KB)
        // if (sizeInBytes > 100 * 1024) {
        //   logger.warn(`Large request detected: ${sizeInMB}MB on ${req.method} ${req.path}`, BOOTSTRAP_CONTEXT);
        // }
      }
      next();
    });

    // Comprehensive security middleware
    app.use(helmet({
      // HTTP Strict Transport Security (HSTS)
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true
      },
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger UI
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"]
        }
      },
      // Additional security headers
      crossOriginEmbedderPolicy: { policy: "require-corp" },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' }, // X-Frame-Options: DENY
      hidePoweredBy: true,
      ieNoOpen: true,
      noSniff: true, // X-Content-Type-Options: nosniff
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: "no-referrer" },
      xssFilter: true
    }));

    // Enhanced CORS configuration
    app.enableCors({
      origin: appConfig.cors.allowedOrigins, // Changed from '*' to false for security
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
      optionsSuccessStatus: 200, // For legacy browser support
      maxAge: 86400 // Cache preflight response for 24 hours
    });

    // Global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Set global API prefix for all routes except health endpoints
    app.setGlobalPrefix('expenses-ai/api', {
      exclude: [
        'expenses-ai/health',
        'expenses-ai/ready',
        'expenses-ai/live',
        'expenses-ai/health/aws/textract',
        'expenses-ai/health/aws/bedrock',
        'expenses-ai/health/circuit-breakers',
        'expenses-ai/admin/queues',
        'expenses-ai/admin/queues/(.*)',
      ],
    });

    // Swagger configuration
    const config = new DocumentBuilder()
      .setTitle('Expense ai ')
      .setVersion('2.0.0')
      .addBearerAuth()
      .addTag('api')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('expenses-ai/api/docs', app, document);

    const port = appConfig.port;
    app.enableShutdownHooks();

    // Perform startup health checks before accepting traffic
    // This ensures critical dependencies (database, Redis) are available
    const dbHealth = app.get(MySqlHealthIndicator);
    const redisHealth = app.get(RedisHealthIndicator);

    logger.log('Performing startup health checks...', BOOTSTRAP_CONTEXT);

    try {
      logger.log('Checking database health...', BOOTSTRAP_CONTEXT);
      const dbResult = await dbHealth.isHealthy('database');
      logger.log('Database health check passed: ' + JSON.stringify(dbResult), BOOTSTRAP_CONTEXT);

      logger.log('Checking Redis health...', BOOTSTRAP_CONTEXT);
      const redisResult = await redisHealth.isHealthy('redis');
      logger.log('Redis health check passed: ' + JSON.stringify(redisResult), BOOTSTRAP_CONTEXT);

      logger.log('Startup health checks passed', BOOTSTRAP_CONTEXT);
    } catch (healthError) {
      const msg = healthError instanceof Error ? healthError.message : String(healthError);
      const stack = healthError instanceof Error ? healthError.stack : 'N/A';
      logger.error('Startup health checks failed - dependencies not ready: ' + msg, undefined, BOOTSTRAP_CONTEXT);
      logger.error('Stack trace: ' + stack, undefined, BOOTSTRAP_CONTEXT);
      throw healthError;
    }

    await app.listen(port);

    // Configure HTTP server timeouts
    const server = app.getHttpServer();
    server.setTimeout(300000); // 5 minutes - overall request timeout
    server.keepAliveTimeout = 65000; // 65 seconds - slightly higher than ALB's 60s default
    server.headersTimeout = 66000; // 66 seconds - must be > keepAliveTimeout

    logger.log(`Application is running on: http://localhost:${port}`, BOOTSTRAP_CONTEXT);
    logger.log('HTTP server timeouts configured: request=300s, keepAlive=65s, headers=66s', BOOTSTRAP_CONTEXT);
  } catch (error) {
    gracefulExit(error instanceof Error ? error : new Error(String(error)));
  }
}

bootstrap();
