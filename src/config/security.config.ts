import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();
const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
const corsOrigins = allowedOrigins
  ? allowedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  : ['http://localhost:3000'];

export const securityConfig = {
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  fileUpload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'],
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ],
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
};
