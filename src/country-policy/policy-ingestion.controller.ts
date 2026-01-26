import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Logger,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PolicyIngestionService } from './services/policy-ingestion.service';
import { PolicyIngestionDto, PolicyIngestionResponseDto, PolicyRetrievalResponseDto } from './dto/policy-ingestion.dto';

/**
 * Controller for policy document ingestion and retrieval.
 * 
 * Provides endpoints to:
 * - Upload and ingest policy documents (PDF, DOCX)
 * - Retrieve policy markdown for a country
 */
@ApiTags('Country Policy')
@Controller('api/country-policy')
export class PolicyIngestionController {
    private readonly logger = new Logger(PolicyIngestionController.name);

    constructor(private readonly policyIngestionService: PolicyIngestionService) { }

    /**
     * Ingest a policy document for a country.
     * 
     * Accepts PDF or DOCX files, converts them to markdown with page markers,
     * identifies ICPs, and stores the policy in the database.
     */
    @Post('ingest')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('policyFile'))
    @ApiOperation({
        summary: 'Ingest a policy document',
        description: 'Upload a policy document (PDF, DOCX) to convert to markdown and store for a country'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['country', 'policyFile'],
            properties: {
                policyFile: {
                    type: 'string',
                    format: 'binary',
                    description: 'Policy document file (PDF or DOCX)',
                },
                country: {
                    type: 'string',
                    description: 'Country name for the policy',
                },
                countryCode: {
                    type: 'string',
                    description: 'ISO country code (e.g., "AT", "US")',
                },
                icps: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of ICP identifiers (optional - will be auto-detected if not provided)',
                },
                title: {
                    type: 'string',
                    description: 'Policy document title',
                },
                effectiveDate: {
                    type: 'string',
                    description: 'Policy effective date (ISO format)',
                },
                version: {
                    type: 'string',
                    description: 'Policy version identifier',
                },
            },
        },
    })
    @ApiResponse({
        status: 201,
        description: 'Policy ingested successfully',
        type: PolicyIngestionResponseDto
    })
    @ApiResponse({ status: 400, description: 'Invalid file or request data' })
    async ingestPolicy(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
                    new FileTypeValidator({
                        fileType: /(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|png|jpg|jpeg)$/i
                    }),
                ],
            }),
        )
        file: Express.Multer.File,
        @Body() dto: PolicyIngestionDto,
    ): Promise<PolicyIngestionResponseDto> {
        this.logger.log(`Received policy ingestion request for ${dto.country}, file: ${file.originalname}`);

        // Parse ICPs from string if sent as JSON string (multipart form limitation)
        const icpsValue = dto.icps as unknown;
        if (typeof icpsValue === 'string') {
            try {
                dto.icps = JSON.parse(icpsValue);
            } catch {
                dto.icps = icpsValue.split(',').map(s => s.trim()).filter(s => s);
            }
        }

        return this.policyIngestionService.ingestPolicy(file, dto);
    }

    /**
     * Get the policy markdown for a country
     */
    @Get(':country/markdown')
    @ApiOperation({
        summary: 'Get policy markdown',
        description: 'Retrieve the full policy markdown document for a country'
    })
    @ApiParam({ name: 'country', description: 'Country name' })
    @ApiResponse({
        status: 200,
        description: 'Policy markdown retrieved',
        schema: { type: 'object', properties: { markdown: { type: 'string' } } }
    })
    @ApiResponse({ status: 404, description: 'Country or policy not found' })
    async getPolicyMarkdown(
        @Param('country') country: string,
    ): Promise<{ markdown: string }> {
        const markdown = await this.policyIngestionService.getPolicyMarkdown(country);
        return { markdown };
    }

    /**
     * Get full policy details for a country
     */
    @Get(':country')
    @ApiOperation({
        summary: 'Get policy details',
        description: 'Retrieve the full policy record with markdown and metadata for a country'
    })
    @ApiParam({ name: 'country', description: 'Country name' })
    @ApiResponse({
        status: 200,
        description: 'Policy details retrieved',
        type: PolicyRetrievalResponseDto
    })
    @ApiResponse({ status: 404, description: 'Country or policy not found' })
    async getPolicy(
        @Param('country') country: string,
    ): Promise<PolicyRetrievalResponseDto> {
        const policy = await this.policyIngestionService.getPolicy(country);

        return {
            country,
            policyMarkdown: policy.policyMarkdown,
            icps: policy.icps,
            pageCount: policy.pageCount,
            metadata: policy.policyMetadata,
        };
    }

    /**
     * Trigger synchronization of DB policies to seeds file (Dev only)
     */
    @Post('sync-seeds')
    @ApiOperation({
        summary: 'Sync policies to seeds file',
        description: 'Updates the src/seeds/country-policies.seed.ts file with current DB state (Development only)'
    })
    @ApiResponse({ status: 200, description: 'Seeds synced successfully' })
    async syncSeeds(): Promise<{ success: boolean; message: string }> {
        if (process.env.NODE_ENV === 'production') {
            return { success: false, message: 'Not available in production' };
        }

        await this.policyIngestionService.syncSeeds();
        return { success: true, message: 'Seeds synced successfully' };
    }
}
