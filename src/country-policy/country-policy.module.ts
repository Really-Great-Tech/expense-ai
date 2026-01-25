import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Country } from './entities/country.entity';
import { Version } from './entities/version.entity';
import { CountryPolicy } from './entities/country-policy.entity';
import { Datasource } from './entities/datasource.entity';
import { CountryPolicyService } from './services/country-policy.service';
import { CountryValidationService } from './services/country-validation.service';
import { IcpValidationService } from './services/icp-validation.service';
import { PolicyIngestionService } from './services/policy-ingestion.service';
import { PolicyIngestionController } from './policy-ingestion.controller';
import { IsValidCountryConstraint } from '../common/validators/is-valid-country.validator';
import { IsValidIcpConstraint } from '../common/validators/is-valid-icp.validator';

@Module({
  imports: [
    // Keep all entities for migrations seeding
    TypeOrmModule.forFeature([Country, Version, CountryPolicy, Datasource]),
    // Configure Multer for file uploads
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  ],
  controllers: [PolicyIngestionController],
  providers: [
    CountryPolicyService,
    CountryValidationService,
    IcpValidationService,
    PolicyIngestionService,
    IsValidCountryConstraint,
    IsValidIcpConstraint,
  ],
  exports: [
    CountryPolicyService,
    CountryValidationService,
    IcpValidationService,
    PolicyIngestionService,
    IsValidCountryConstraint,
    IsValidIcpConstraint,
    TypeOrmModule,
  ],
})
export class CountryPolicyModule { }
