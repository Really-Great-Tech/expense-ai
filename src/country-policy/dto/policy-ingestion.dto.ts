import { IsString, IsOptional, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for policy document ingestion request
 */
export class PolicyIngestionDto {
    @ApiProperty({ description: 'Country name for the policy' })
    @IsString()
    country: string;

    @ApiPropertyOptional({ description: 'ISO country code (e.g., "AT", "US")' })
    @IsOptional()
    @IsString()
    countryCode?: string;

    @ApiPropertyOptional({
        description: 'List of ICP identifiers. If not provided, LLM will identify them from the document.',
        type: [String]
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                // Try to parse as JSON first
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed;
                return [value];
            } catch {
                // Split by comma if not JSON
                return value.split(',').map(s => s.trim()).filter(s => s);
            }
        }
        return value;
    })
    @IsArray()
    @IsString({ each: true })
    icps?: string[];

    @ApiPropertyOptional({ description: 'Policy document title' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ description: 'Policy effective date (ISO format)' })
    @IsOptional()
    @IsString()
    effectiveDate?: string;

    @ApiPropertyOptional({ description: 'Policy version identifier' })
    @IsOptional()
    @IsString()
    version?: string;
}

/**
 * Response DTO for successful policy ingestion
 */
export class PolicyIngestionResponseDto {
    @ApiProperty({ description: 'Whether the ingestion was successful' })
    success: boolean;

    @ApiProperty({ description: 'ID of the country record' })
    countryId: number;

    @ApiProperty({ description: 'ID of the created policy record' })
    policyId: number;

    @ApiProperty({ description: 'Extracted policy markdown with page markers' })
    policyMarkdown: string;

    @ApiProperty({ description: 'List of ICP identifiers found/provided', type: [String] })
    icps: string[];

    @ApiProperty({ description: 'Number of pages in the document' })
    pageCount: number;

    @ApiPropertyOptional({ description: 'Original filename of the uploaded document' })
    sourceFile?: string;
}

/**
 * DTO for policy retrieval response
 */
export class PolicyRetrievalResponseDto {
    @ApiProperty({ description: 'Country name' })
    country: string;

    @ApiProperty({ description: 'Full policy document in markdown with page markers' })
    policyMarkdown: string;

    @ApiProperty({ description: 'List of ICP identifiers', type: [String] })
    icps: string[];

    @ApiProperty({ description: 'Number of pages' })
    pageCount: number;

    @ApiPropertyOptional({ description: 'Policy metadata' })
    metadata?: {
        title?: string;
        effectiveDate?: string;
        version?: string;
        sourceFile?: string;
        parsedDate?: string;
        parserUsed?: string;
    };
}
