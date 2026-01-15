import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for uploading country policy documents
 */
export class UploadPolicyDto {
  @ApiProperty({
    description: 'Country name for the policy (e.g., Germany, France, China)',
    example: 'Germany',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  countryName: string;

  @ApiProperty({
    description: 'Optional country code (ISO 3166-1 alpha-2). If not provided, will be derived from country name.',
    example: 'DE',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, { message: 'Country code must be 2 uppercase letters (e.g., DE, FR, CN)' })
  countryCode?: string;

  @ApiProperty({
    description: 'Optional description or notes about this policy upload',
    example: 'Q1 2025 policy update with new travel expense rules',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
