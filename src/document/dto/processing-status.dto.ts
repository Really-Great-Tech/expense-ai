import { ApiProperty } from '@nestjs/swagger';

export class ProcessingStatusDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'job_123456789',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current job status',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed'],
    example: 'active',
  })
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

  @ApiProperty({
    description: 'Error message (if failed)',
    required: false,
    example: 'Document processing failed: Invalid file format',
  })
  error?: string;

  @ApiProperty({
    description: 'Job creation timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:35:00Z',
  })
  updatedAt: Date;
}

export class ProcessingStatusResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Processing status data',
    type: ProcessingStatusDto,
  })
  data: ProcessingStatusDto;
}
