import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageService } from './services/local-storage.service';
import { S3StorageService } from './services/s3-storage.service';
import { StorageResolverService } from './services/storage-resolver.service';
import { FileStorageService } from './interfaces/file-storage.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageService,
    {
      provide: 'FILE_STORAGE_SERVICE',
      useFactory: (
        configService: ConfigService,
        localStorageService: LocalStorageService,
      ): FileStorageService => {
        const storageTypeRaw = configService.get('STORAGE_TYPE', 'local');
        const storageType = (storageTypeRaw ?? 'local').toString().toLowerCase();

        if (storageType === 's3') {
          // Lazily instantiate S3 only when configured
          return new S3StorageService(configService);
        }
        return localStorageService;
      },
      inject: [ConfigService, LocalStorageService],
    },
    StorageResolverService,
    {
      provide: 'exports',
      useValue: ['FILE_STORAGE_SERVICE', LocalStorageService, StorageResolverService],
    },
  ],
  exports: [
    'FILE_STORAGE_SERVICE',
    LocalStorageService,
    StorageResolverService,
  ],
})
export class StorageModule {}
