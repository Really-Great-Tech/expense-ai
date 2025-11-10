import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { IsValidCountry } from '../../common/validators/is-valid-country.validator';

export class SingleReceiptRequestDto {
  @ApiProperty({
    description: 'User ID initiating the upload and ownership for storage/processing',
    example: 'user_12345',
    required: true,
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Country name for downstream compliance processing',
    example: 'United States',
    required: true,
  })
  @IsValidCountry({
    message: 'Please provide a valid country name (e.g., "Germany", "United States")'
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'ICP (Internal Control Procedure) or policy context for downstream processing',
    example: 'DEFAULT',
    required: true,
  })
  @IsString()
  icp: string;

  @ApiProperty({
    description: 'Document reader for receipt processing (e.g., textract)',
    enum: ['textract'],
    default: 'textract',
    required: false,
  })
  @IsOptional()
  @IsString()
  documentReader?: string;
}
