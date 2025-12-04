console.log('📄 main.ts file loaded - starting imports...');
import { NestFactory } from '@nestjs/core';
console.log('✅ NestFactory imported');
import { AppModule } from './app.module';
console.log('✅ AppModule imported');
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger/logger.service';
import { useContainer } from 'class-validator';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getRabbitMQConfig } from './shared/config/rabbitmq.config';

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately - let the app try to recover
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

async function bootstrap() {
  console.log('🚀 Bootstrap function called - starting application...');
  const logger = new Logger('Bootstrap');
  try {
    console.log('📦 Creating NestJS application...');
    console.log('⚠️  This may take a moment if migrations need to run...');
    const app = await NestFactory.create(AppModule, { 
      bufferLogs: true,
      abortOnError: false, // Don't abort on error, let us handle it
    });
    console.log('✅ NestJS application created successfully');
    const appLogger = app.get(LoggerService);
    app.useLogger(appLogger);
    const configService = app.get(ConfigService);

    // Enable class-validator to use NestJS's DI container for custom validators
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

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
      origin: configService.get('ALLOWED_ORIGINS', false), // Changed from '*' to false for security
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

    // Connect as RabbitMQ microservice for consuming events
    // Make RabbitMQ connection non-blocking - app can start even if RabbitMQ is temporarily unavailable
    try {
      const rabbitMQConfig = getRabbitMQConfig(configService, 'expense-ai-queue');
      app.connectMicroservice<MicroserviceOptions>(rabbitMQConfig);
      await app.startAllMicroservices();
      logger.log('RabbitMQ microservice connected to queue: expense-ai-queue');
    } catch (rabbitError) {
      logger.warn(
        `Failed to connect to RabbitMQ microservice: ${rabbitError instanceof Error ? rabbitError.message : rabbitError}. Application will continue without RabbitMQ.`,
      );
      // Don't exit - allow the app to start without RabbitMQ
    }

    const port = configService.get('PORT', 3000);
    console.log(`🌐 Starting HTTP server on port ${port}...`);
    app.enableShutdownHooks();
    await app.listen(port);
    console.log(`✅ Application is running on: http://localhost:${port}`);
    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    // Ensure error is logged to console before exiting
    console.error('FATAL ERROR during application bootstrap:', error);
    logger.error(
      `Error during application bootstrap: ${error instanceof Error ? error.message : error}`,
      error instanceof Error ? error.stack : undefined,
    );
    // Give time for logs to flush
    await new Promise(resolve => setTimeout(resolve, 100));
    process.exit(1);
  }
}

// Wrap bootstrap in try-catch to catch any synchronous errors
bootstrap().catch((error) => {
  console.error('❌ Unhandled error in bootstrap:', error);
  console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  process.exit(1);
});
