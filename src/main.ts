import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './tools/logger/logger.service';
import { useContainer } from 'class-validator';
import { DatabaseHealthIndicator } from './health/database-health.indicator';
import { RedisHealthEnhancedIndicator } from './health/redis-health-enhanced.indicator';
import { validateEnvironment } from './config/env-validation';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';

const logger = new Logger('Bootstrap');

function gracefulExit(error: Error | string, exitCode = 1): void {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(`Fatal error: ${message}`, stack);
  logger.error('Application failed to start - shutting down');

  setTimeout(() => process.exit(exitCode), 100);
}

process.on('uncaughtException', (error) => {
  gracefulExit(error);
});

process.on('unhandledRejection', (reason) => {
  gracefulExit(reason instanceof Error ? reason : new Error(String(reason)));
});

async function bootstrap() {
  // Validate environment variables early, before creating the NestJS app
  logger.log('Validating environment configuration...');
  validateEnvironment();

  try {
    logger.log('Creating NestJS application...');
    const app = await NestFactory.create(AppModule, { bufferLogs: false }); // Disable buffer for verbose logging
    logger.log('NestJS application created successfully');
    const appLogger = app.get(LoggerService);
    app.useLogger(appLogger);
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

    logger.log(`Request body size limits configured: JSON=${bodyLimit}, URL-encoded=${urlEncodedLimit}`);

    // Request size monitoring middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength, 10);
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

        // Log large requests for monitoring (> 100KB)
        if (sizeInBytes > 100 * 1024) {
          logger.warn(`Large request detected: ${sizeInMB}MB on ${req.method} ${req.path}`);
        }
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
      exclude: ['expenses-ai/health', 'expenses-ai/ready', 'expenses-ai/health/redis', 'expenses-ai/health/database', 'health-check'],
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
    const dbHealth = app.get(DatabaseHealthIndicator);
    const redisHealth = app.get(RedisHealthEnhancedIndicator);

    logger.log('Performing startup health checks...');

    try {
      logger.log('Checking database health...');
      const dbResult = await dbHealth.isHealthy('database', 10000);
      logger.log('Database health check passed: ' + JSON.stringify(dbResult));

      logger.log('Checking Redis health...');
      const redisResult = await redisHealth.isHealthy('redis-queue', 10000, false); // Skip BullMQ for startup
      logger.log('Redis health check passed: ' + JSON.stringify(redisResult));

      logger.log('Startup health checks passed');
    } catch (healthError) {
      const msg = healthError instanceof Error ? healthError.message : String(healthError);
      const stack = healthError instanceof Error ? healthError.stack : 'N/A';
      logger.error('Startup health checks failed - dependencies not ready: ' + msg);
      logger.error('Stack trace: ' + stack);
      throw healthError;
    }

    await app.listen(port);

    // Configure HTTP server timeouts
    const server = app.getHttpServer();
    server.setTimeout(300000); // 5 minutes - overall request timeout
    server.keepAliveTimeout = 65000; // 65 seconds - slightly higher than ALB's 60s default
    server.headersTimeout = 66000; // 66 seconds - must be > keepAliveTimeout

    logger.log(`Application is running on: http://localhost:${port}`);
    logger.log('HTTP server timeouts configured: request=300s, keepAlive=65s, headers=66s');
  } catch (error) {
    gracefulExit(error instanceof Error ? error : new Error(String(error)));
  }
}

bootstrap();
