import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRabbitMQClientConfig } from '../shared/config/rabbitmq.config';
import { DocumentModule } from '../document/document.module';
import { DocumentSplitterModule } from '../document-splitter/document-splitter.module';
import { CountryPolicyModule } from '../country-policy/country-policy.module';
import { StorageModule } from '../storage/storage.module';
import { ExpenseProcessingService } from '@/document/processing.service';
import { ExpenseProcessor } from './processors/expense.processor';

@Module({
  imports: [
    // RabbitMQ Client for publishing events
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_CLIENT',
        imports: [ConfigModule],
        useFactory: getRabbitMQClientConfig,
        inject: [ConfigService],
      },
    ]),
    DocumentModule,
    DocumentSplitterModule, // Import for DocumentPersistenceService
    CountryPolicyModule, // Import for CountryPolicyService
    StorageModule,
  ],
  providers: [ExpenseProcessingService, ExpenseProcessor],
  exports: [ExpenseProcessingService, DocumentModule],
})
export class ProcessingModule {}
