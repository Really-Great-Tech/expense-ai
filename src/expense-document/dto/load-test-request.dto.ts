import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { IsValidCountry } from '../../common/validators/is-valid-country.validator';
import { IsValidIcp } from '../../common/validators/is-valid-icp.validator';

export class LoadTestRequestDto {
  @ApiProperty({
    description: 'User ID for the load test requests',
    example: 'load-test-user',
    required: true,
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Country name for compliance processing',
    example: 'Germany',
    required: true,
  })
  @IsValidCountry({
    message: 'Please provide a valid country name (e.g., "Germany", "United States")',
  })
  @IsString()
  country: string;

  @ApiProperty({
    description: 'ICP (Internal Control Procedure) or policy context',
    example: 'Global People',
    required: true,
  })
  @IsValidIcp({
    message: 'Please provide a valid ICP name for the specified country',
  })
  @IsString()
  icp: string;

  @ApiProperty({
    description: 'Document reader for processing',
    enum: ['textract'],
    default: 'textract',
    required: false,
  })
  @IsOptional()
  @IsString()
  documentReader?: string;

  @ApiProperty({
    description: 'Number of times to call the service',
    example: 50,
    default: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  count?: number;

  @ApiProperty({
    description: 'Number of concurrent requests per batch',
    example: 5,
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  concurrent?: number;

  @ApiProperty({
    description: 'Delay in milliseconds between batches to prevent overwhelming external services',
    example: 2000,
    default: 2000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(30000)
  delayBetweenBatches?: number;
}
