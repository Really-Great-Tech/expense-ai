import { Injectable, Logger } from '@nestjs/common';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';
import { IcpValidationService } from '../../country-policy/services/icp-validation.service';

@ValidatorConstraint({ name: 'IsValidIcp', async: true })
@Injectable()
export class IsValidIcpConstraint implements ValidatorConstraintInterface {
  private readonly logger = new Logger(IsValidIcpConstraint.name);

  constructor(private readonly icpValidationService: IcpValidationService) {}

  async validate(icp: any, args: ValidationArguments): Promise<boolean> {
    if (!icp || typeof icp !== 'string') {
      return false;
    }

    // Get country from the same object being validated
    const object = args.object as any;
    const country = object.country;

    if (!country) {
      this.logger.warn('ICP validation failed: country field is missing');
      return false;
    }

    try {
      return await this.icpValidationService.isValidIcp(country, icp.trim());
    } catch (error) {
      this.logger.warn(`ICP validation error for "${icp}" in "${country}": ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as any;
    const country = object.country || 'unknown country';
    return `ICP '${args.value}' is not valid for country '${country}'. Please provide a valid ICP name.`;
  }
}

export function IsValidIcp(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidIcp',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsValidIcpConstraint,
    });
  };
}
