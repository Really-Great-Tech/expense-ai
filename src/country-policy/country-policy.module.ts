import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './entities/country.entity';
import { Version } from './entities/version.entity';
import { CountryPolicy } from './entities/country-policy.entity';
import { Datasource } from './entities/datasource.entity';
import { CountryPolicyService } from './services/country-policy.service';
import { CountryValidationService } from './services/country-validation.service';
import { IcpValidationService } from './services/icp-validation.service';
import { PolicyPersistenceService } from './services/policy-persistence.service';
import { PolicySeedWriterService } from './services/policy-seed-writer.service';
import { PolicyUploadOrchestrator } from './services/policy-upload-orchestrator.service';
import { PolicyUploadController } from './controllers/policy-upload.controller';
import { PolicyExtractionAgent } from '../agents/policy-extraction.agent';
import { IsValidCountryConstraint } from '../common/validators/is-valid-country.validator';
import { IsValidIcpConstraint } from '../common/validators/is-valid-icp.validator';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    // Keep all entities for migrations seeding
    TypeOrmModule.forFeature([Country, Version, CountryPolicy, Datasource]),
    // Import storage for file uploads
    StorageModule,
  ],
  controllers: [PolicyUploadController],
  providers: [
    // Existing services
    CountryPolicyService,
    CountryValidationService,
    IcpValidationService,
    // Policy upload pipeline services
    PolicyPersistenceService,
    PolicySeedWriterService,
    PolicyUploadOrchestrator,
    PolicyExtractionAgent,
    // Validators
    IsValidCountryConstraint,
    IsValidIcpConstraint,
  ],
  exports: [
    CountryPolicyService,
    CountryValidationService,
    IcpValidationService,
    IsValidCountryConstraint,
    IsValidIcpConstraint,
    TypeOrmModule,
  ],
})
export class CountryPolicyModule { }
