import { registerDecorator, ValidationOptions, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { Injectable, Logger } from '@nestjs/common';
import { CountryValidationService } from '../../country-policy/services/country-validation.service';

@ValidatorConstraint({ name: 'IsValidCountry', async: true })
@Injectable()
export class IsValidCountryConstraint implements ValidatorConstraintInterface {
  private readonly logger = new Logger(IsValidCountryConstraint.name);

  constructor(private readonly countryValidationService: CountryValidationService) {}

  async validate(countryName: any, args: ValidationArguments): Promise<boolean> {
    if (!countryName || typeof countryName !== 'string') {
      return false;
    }

    try {
      return await this.countryValidationService.isValidCountry(countryName.trim());
    } catch (error) {
      // Log error but don't fail validation - let it return false
      this.logger.error(`Country validation error for "${countryName}": ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `Country '${args.value}' is not valid or not currently supported. Please use a valid country name.`;
  }
}

export function IsValidCountry(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidCountry',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsValidCountryConstraint,
    });
  };
}
