import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Country } from '../entities/country.entity';
import { CountryPolicy, PolicyMetadata } from '../entities/country-policy.entity';
import { Version } from '../entities/version.entity';
import { DocumentReaderFactory } from '../../utils/documentReaderFactory';
import { PolicyIngestionDto, PolicyIngestionResponseDto } from '../dto/policy-ingestion.dto';
import { BedrockLlmService } from '../../services/bedrock/bedrock-llm';
import { AGENT_PROFILES } from '../../agents/config/models.config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service for ingesting policy documents and converting them to markdown format
 * with page markers for citation and verification purposes.
 */
@Injectable()
export class PolicyIngestionService {
    private readonly logger = new Logger(PolicyIngestionService.name);

    constructor(
        @InjectRepository(Country)
        private readonly countryRepository: Repository<Country>,
        @InjectRepository(CountryPolicy)
        private readonly policyRepository: Repository<CountryPolicy>,
        @InjectRepository(Version)
        private readonly versionRepository: Repository<Version>,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Ingest a policy document and store it as markdown
     * 
     * @param file - The uploaded policy document (PDF, DOCX, etc.)
     * @param dto - Metadata about the policy
     * @returns The created policy record with markdown content
     */
    async ingestPolicy(
        file: Express.Multer.File,
        dto: PolicyIngestionDto
    ): Promise<PolicyIngestionResponseDto> {
        this.logger.log(`Ingesting policy for ${dto.country} from file: ${file.originalname}`);

        // 1. Parse document to markdown with page markers
        const { markdown, pageCount } = await this.parseDocumentToMarkdown(file);
        this.logger.log(`Parsed document: ${pageCount} pages, ${markdown.length} characters`);

        // 2. Identify ICPs if not provided
        let icps = dto.icps || [];
        if (icps.length === 0) {
            this.logger.log('No ICPs provided, identifying from document...');
            icps = await this.identifyIcps(markdown);
            this.logger.log(`Identified ${icps.length} ICPs: ${icps.join(', ')}`);
        }

        // 3. Get or create country record
        let country = await this.countryRepository.findOne({
            where: { name: dto.country },
            relations: ['activePolicy'],
        });

        if (!country) {
            this.logger.log(`Creating new country record for ${dto.country}`);
            country = this.countryRepository.create({
                name: dto.country,
                code: dto.countryCode,
                active: true,
            });
            country = await this.countryRepository.save(country);
        }

        // 4. Create version record
        const versionId = new Date().toISOString().replace(/[:.]/g, '-');
        let version = await this.versionRepository.findOne({
            where: { countryId: country.id, versionId },
        });

        if (!version) {
            version = this.versionRepository.create({
                countryId: country.id,
                versionId,
            });
            version = await this.versionRepository.save(version);
        }

        // 5. Create policy record with markdown
        const metadata: PolicyMetadata = {
            title: dto.title,
            effectiveDate: dto.effectiveDate,
            version: dto.version,
            sourceFile: file.originalname,
            parsedDate: new Date().toISOString(),
            parserUsed: 'Textract',
        };

        const policy = this.policyRepository.create({
            policyMarkdown: markdown,
            pageCount,
            icps,
            policyMetadata: metadata,
            versionCountryId: country.id,
            versionId: version.versionId,
        });

        const savedPolicy = await this.policyRepository.save(policy);
        this.logger.log(`Created policy record with ID: ${savedPolicy.id}`);

        // 6. Set as active policy for the country
        country.activePolicyId = savedPolicy.id;
        await this.countryRepository.save(country);
        this.logger.log(`Set policy ${savedPolicy.id} as active for ${dto.country}`);

        const response = {
            success: true,
            countryId: country.id,
            policyId: savedPolicy.id,
            policyMarkdown: markdown,
            icps,
            pageCount,
            sourceFile: file.originalname,
        };

        // Sync seeds file in development mode
        if (process.env.NODE_ENV !== 'production') {
            this.syncSeeds().catch(err =>
                this.logger.error(`Failed to sync seeds: ${err.message}`)
            );
        }

        return response;
    }

    /**
     * Update the seeds file with current database state
     */
    async syncSeeds(): Promise<void> {
        try {
            const countries = await this.countryRepository.find({
                relations: ['activePolicy'],
            });

            const seeds: Record<string, any> = {};

            for (const country of countries) {
                if (country.activePolicy) {
                    seeds[country.name] = {
                        name: country.name,
                        code: country.code,
                        policyMarkdown: country.activePolicy.policyMarkdown,
                        pageCount: country.activePolicy.pageCount,
                        icps: country.activePolicy.icps,
                        metadata: country.activePolicy.policyMetadata,
                    };
                }
            }

            const seedFilePath = path.join(process.cwd(), 'src/seeds/country-policies.seed.ts');

            if (fs.existsSync(seedFilePath)) {
                let content = fs.readFileSync(seedFilePath, 'utf8');

                // Find the start of the export object
                const startMarker = 'export const COUNTRY_POLICY_SEEDS: Record<string, CountryPolicySeed> = {';
                const startIndex = content.indexOf(startMarker);

                if (startIndex !== -1) {
                    const startContent = content.substring(0, startIndex + startMarker.length);
                    // Generate formatted JSON content for the object body
                    // Remove opening brace since it's in startContent and closing brace for end
                    const jsonContent = JSON.stringify(seeds, null, 2);
                    // Remove first "{" and last "}" to fit into the variable declaration
                    const innerContent = jsonContent.substring(1, jsonContent.length - 1);

                    const newContent = `${startContent}\n${innerContent}\n};`;

                    fs.writeFileSync(seedFilePath, newContent);
                    this.logger.log(`Synced ${Object.keys(seeds).length} policies to seeds file`);
                }
            }
        } catch (error) {
            this.logger.error('Error syncing seeds file:', error);
            throw error;
        }
    }

    /**
     * Parse a document to markdown with page markers using Textract
     */
    private async parseDocumentToMarkdown(
        file: Express.Multer.File
    ): Promise<{ markdown: string; pageCount: number }> {
        const reader = DocumentReaderFactory.getDefaultReader(this.configService, 'textract');

        const parseConfig = {
            featureTypes: ['TABLES', 'FORMS'],
            outputFormat: 'markdown' as const,
        };

        const result = await reader.parseDocumentFromBuffer(
            file.buffer,
            file.originalname,
            parseConfig
        );

        if (!result.success || !result.data) {
            const errorMsg = 'error' in result ? result.error : 'Unknown parsing error';
            throw new BadRequestException(`Failed to parse document: ${errorMsg}`);
        }

        // Count pages from [[PAGE_X]] markers
        const pageMarkers = result.data.match(/\[\[PAGE_\d+\]\]/g) || [];
        const pageCount = pageMarkers.length > 0 ? pageMarkers.length : 1;

        return {
            markdown: result.data,
            pageCount,
        };
    }

    /**
     * Identify ICPs from the policy document using LLM
     */
    private async identifyIcps(markdown: string): Promise<string[]> {
        try {
            const llm = new BedrockLlmService({ profile: AGENT_PROFILES.COMPLIANCE });

            const prompt = `Analyze the following policy document and identify all Internal Control Policy (ICP) identifiers or company names mentioned.

Look for:
- Section headers like "ICP001", "ICP-002", "Policy 003"
- Company names that policies apply to
- Entity names that are mentioned as the employer or policy holder

Return ONLY a JSON array of strings with the ICP identifiers or company names found.
If no specific ICPs are found, return ["GENERAL"].

Example response: ["ICP001", "Global People IT-Services GmbH", "GoGlobal Europe GmbH"]

POLICY DOCUMENT:
${markdown.substring(0, 15000)}

Return ONLY the JSON array, no other text:`;

            const response = await llm.chat({
                messages: [{ role: 'user', content: prompt }],
            });

            // Extract content from the response
            const messageContent = response.message?.content as string | any[] | undefined;
            let textContent = '';

            if (typeof messageContent === 'string') {
                textContent = messageContent;
            } else if (Array.isArray(messageContent)) {
                const textBlock = messageContent.find((c) => c.type === 'text' || 'text' in c);
                if (textBlock && 'text' in textBlock) {
                    textContent = textBlock.text;
                }
            }

            if (textContent) {
                // Extract JSON array from response
                const jsonMatch = textContent.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const icps = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(icps) && icps.length > 0) {
                        return icps;
                    }
                }
            }

            return ['GENERAL'];
        } catch (error: any) {
            this.logger.warn(`Failed to identify ICPs via LLM: ${error.message}, defaulting to GENERAL`);
            return ['GENERAL'];
        }
    }

    /**
     * Get policy markdown for a country
     */
    async getPolicyMarkdown(countryName: string): Promise<string> {
        const country = await this.countryRepository.findOne({
            where: { name: countryName },
            relations: ['activePolicy'],
        });

        if (!country) {
            throw new NotFoundException(`Country not found: ${countryName}`);
        }

        if (!country.activePolicy?.policyMarkdown) {
            throw new NotFoundException(`No active policy with markdown found for: ${countryName}`);
        }

        return country.activePolicy.policyMarkdown;
    }

    /**
     * Get full policy details for a country
     */
    async getPolicy(countryName: string): Promise<CountryPolicy> {
        const country = await this.countryRepository.findOne({
            where: { name: countryName },
            relations: ['activePolicy'],
        });

        if (!country) {
            throw new NotFoundException(`Country not found: ${countryName}`);
        }

        if (!country.activePolicy) {
            throw new NotFoundException(`No active policy found for: ${countryName}`);
        }

        return country.activePolicy;
    }
}
