import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';
import { IsValidCountry } from '../../common/validators/is-valid-country.validator';

export class SplitRequestDto {
  @ApiProperty({
    description: 'User ID initiating the split and ownership for storage/processing',
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
    description: 'Document reader for downstream processing (splitter uses textract internally)',
    enum: ['textract'],
    default: 'textract',
    required: false,
  })
  @IsOptional()
  @IsString()
  documentReader?: string;

  @ApiProperty({
    description: 'Choice for handling detected duplicates',
    enum: ['REFERENCE_EXISTING', 'FORCE_REPROCESS'],
    required: false,
    example: 'REFERENCE_EXISTING'
  })
  @IsOptional()
  @IsIn(['REFERENCE_EXISTING', 'FORCE_REPROCESS'])
  duplicateChoice?: 'REFERENCE_EXISTING' | 'FORCE_REPROCESS';

  @ApiProperty({
    description: 'Force reprocessing even if file already processed',
    default: false,
    required: false,
  })
  @IsOptional()
  forceResplit?: boolean;
}
