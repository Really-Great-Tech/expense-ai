import { Module, MiddlewareConsumer, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config';
import appConfig, { AppConfigType } from './config/app.config';
import { ExpenseDocumentModule } from './expense-document/expense-document.module';
import { WorkersModule } from './workers/workers.module';
import { ExpenseResultModule } from './expense-result/expense-result.module';
import { CountryPolicyModule } from './country-policy/country-policy.module';
import { RedisConfigService } from './config/redis.config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityMiddleware } from './middleware/security.middleware';
import { LoggerModule } from './tools/logger/logger.module';
import { HealthModule } from './health/health.module';
import { DatabaseConfigValidator } from './config/database-validation';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, appConfig],
    }),
    // Throttling - uses centralized app config
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.get<AppConfigType>('app')!;

        return {
          throttlers: [
            {
              ttl: config.throttle.ttl,
              limit: config.throttle.limit,
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
    ExpenseDocumentModule,
    WorkersModule,
    ExpenseResultModule,
    CountryPolicyModule,
    LoggerModule,
    HealthModule, // Health check endpoints for monitoring
  ],
  controllers: [AppController],
  providers: [AppService, RedisConfigService],
})
export class AppModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Validate database configuration on startup
    // This prevents dangerous misconfigurations in production
    DatabaseConfigValidator.validate(this.configService);
  }

  async onModuleDestroy() {
    this.logger.log('Graceful shutdown initiated...');

    // Close database connections
    if (this.dataSource.isInitialized) {
      this.logger.log('Closing database connections...');
      await this.dataSource.destroy();
      this.logger.log('Database connections closed');
    }

    this.logger.log('Graceful shutdown complete');
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
