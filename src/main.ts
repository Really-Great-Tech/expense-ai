import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger/logger.service';
import { useContainer } from 'class-validator';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
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

    // Swagger configuration
    const config = new DocumentBuilder()
      .setTitle('Expense ai ')
      .setVersion('2.0.0')
      .addBearerAuth()
      .addTag('api')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    const port = configService.get('PORT', 3000);
    app.enableShutdownHooks();
    await app.listen(port);
    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    logger.error(
      `Error during application bootstrap: ${error instanceof Error ? error.message : error}`,
      error instanceof Error ? error.stack : undefined,
    );
    process.exit(1);
  }
}

bootstrap();
