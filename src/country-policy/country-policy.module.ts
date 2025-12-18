import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './entities/country.entity';
import { Version } from './entities/version.entity';
import { CountryPolicy } from './entities/country-policy.entity';
import { Datasource } from './entities/datasource.entity';
import { CountryPolicyService } from './services/country-policy.service';
import { CountryValidationService } from './services/country-validation.service';
import { IsValidCountryConstraint } from '../common/validators/is-valid-country.validator';

@Module({
  imports: [
    // Keep all entities for migrations seeding
    TypeOrmModule.forFeature([Country, Version, CountryPolicy, Datasource]),
  ],
  providers: [CountryPolicyService, CountryValidationService, IsValidCountryConstraint],
  exports: [CountryPolicyService, CountryValidationService, IsValidCountryConstraint, TypeOrmModule],
})
export class CountryPolicyModule {}
