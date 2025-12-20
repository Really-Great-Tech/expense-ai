import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';

/**
 * StorageModule - S3 storage configuration
 *
 * Provides S3StorageService for all file storage operations.
 */
@Module({
  imports: [ConfigModule],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}
