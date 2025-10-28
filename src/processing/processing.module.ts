import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { StorageModule } from '../storage/storage.module';
import { ExpenseProcessingService } from '@/document/processing.service';

@Module({
  imports: [DocumentModule, StorageModule],
  providers: [ExpenseProcessingService],
  exports: [ExpenseProcessingService, DocumentModule],
})
export class ProcessingModule {}
