import { Controller, Get, Param, NotFoundException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CountryPolicyService } from '../services/country-policy.service';

@ApiTags('Country Policy Management')
@Controller('country-policy')
export class CountryPolicyController {
    private readonly logger = new Logger(CountryPolicyController.name);

    constructor(private readonly countryPolicyService: CountryPolicyService) { }

    @Get(':country')
    @ApiOperation({
        summary: 'Get Country Policy',
        description: 'Retrieve the active policy, rules, and version information for a specific country.',
    })
    @ApiParam({
        name: 'country',
        description: 'Name of the country (e.g., "Germany")',
        example: 'Germany',
    })
    @ApiResponse({
        status: 200,
        description: '✅ Country policy retrieved successfully',
        schema: {
            example: {
                id: 1,
                name: 'Germany',
                code: 'DE',
                active: true,
                activePolicy: {
                    id: 123,
                    versionId: 'v2025.01.28.120000',
                    rules: {
                        receiptStandards: [],
                        compliancePoliciesGrossUpRelated: [],
                        compliancePoliciesAdditionalInfoRelated: [],
                    },
                    createdAt: '2025-01-28T12:00:00Z',
                },
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: '❌ Country not found',
    })
    async getCountryPolicy(@Param('country') countryName: string) {
        this.logger.log(`Fetching policy for country: ${countryName}`);
        const country = await this.countryPolicyService.findCountryByName(countryName);

        // The service ensures country exists, but let's make sure there is an active policy
        if (!country.activePolicy) {
            // It might be better to return the country info with null policy or throw specific error?
            // For now, let's just return what we have, the consumer can check for activePolicy
        }

        return country;
    }
}
