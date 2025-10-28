import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCountryDto {
  @ApiProperty({
    description: 'Country name',
    example: 'Germany',
    minLength: 2,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO format)',
    example: 'DE',
    maxLength: 10,
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  @Transform(({ value }) => value?.trim()?.toUpperCase())
  code?: string;

  @ApiPropertyOptional({
    description: 'Whether the country is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  active?: boolean = true;
}
