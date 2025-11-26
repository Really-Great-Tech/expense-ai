import { Module, MiddlewareConsumer, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config';
import { DocumentModule } from './document/document.module';
import { ProcessingModule } from './processing/processing.module';
import { CountryPolicyModule } from './country-policy/country-policy.module';
import { RedisConfigService } from './config/redis.config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityMiddleware } from './middleware/security.middleware';
import { DocumentSplitterModule } from './document-splitter/document-splitter.module';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './health/health.module';
import { DatabaseConfigValidator } from './config/database-validation';
import { MigrationService } from './config/migration.service';
import { MigrationController } from './config/migration.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    // Throttling
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ttl = parseInt(configService.get<string>('THROTTLE_TTL', '60'), 10);
        const limit = parseInt(configService.get<string>('THROTTLE_LIMIT', '100'), 10);

        return {
          throttlers: [
            {
              ttl,
              limit,
            },
          ],
        };
      },
    }),

    // BullMQ for job queues
    BullModule.forRootAsync({
      useClass: RedisConfigService,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.get('database'),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    DocumentModule,
    DocumentSplitterModule,
    ProcessingModule,
    CountryPolicyModule,
    LoggerModule,
    HealthModule, // Health check endpoints for monitoring
  ],
  controllers: [AppController, MigrationController],
  providers: [AppService, RedisConfigService, MigrationService],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new (require('@nestjs/common').Logger)(AppModule.name);

  constructor(
    private configService: ConfigService,
    private migrationService: MigrationService,
  ) {}

  async onModuleInit() {
    // Validate database configuration on startup
    // This prevents dangerous misconfigurations in production
    DatabaseConfigValidator.validate(this.configService);

    // Log migration status on startup (migrations run automatically via migrationsRun: true)
    this.logger.log('Checking migration status after startup...');
    try {
      const hasPending = await this.migrationService.hasPendingMigrations();
      const history = await this.migrationService.getMigrationHistory();

      if (hasPending) {
        this.logger.warn('WARNING: There are still pending migrations after startup!');
      } else {
        this.logger.log(`All migrations applied. Total migrations in history: ${history.length}`);
      }
    } catch (error) {
      this.logger.error('Failed to check migration status:', error);
    }
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
