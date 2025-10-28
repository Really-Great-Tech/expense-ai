import { PartialType } from '@nestjs/mapped-types';
import { CreateCountryDto } from './create-country.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCountryDto extends PartialType(CreateCountryDto) {
  @ApiPropertyOptional({
    description: 'Country name',
    example: 'Germany',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO format)',
    example: 'DE',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Whether the country is active',
    example: true,
  })
  active?: boolean;
}
