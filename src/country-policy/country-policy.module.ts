import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './entities/country.entity';
import { Version } from './entities/version.entity';
import { CountryPolicy } from './entities/country-policy.entity';
import { Datasource } from './entities/datasource.entity';
import { CountryPolicyService } from './services/country-policy.service';
import { CountryValidationService } from './services/country-validation.service';
import { CountryPolicyController } from './controllers/country-policy.controller';
import { CountryManagementController } from './controllers/country-management.controller';
import { IsValidCountryConstraint } from '../common/validators/is-valid-country.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Country,
      Version,
      CountryPolicy,
      Datasource,
    ]),
  ],
  controllers: [CountryPolicyController, CountryManagementController],
  providers: [
    CountryPolicyService,
    CountryValidationService,
    IsValidCountryConstraint, // Make validator available for DI
  ],
  exports: [
    CountryPolicyService,
    CountryValidationService,
    IsValidCountryConstraint, // Export for use in other modules
  ],
})
export class CountryPolicyModule {}
