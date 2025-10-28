import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CountryPolicyService } from '../services/country-policy.service';
import { Country } from '../entities/country.entity';
import { Version } from '../entities/version.entity';
import { CountryPolicy } from '../entities/country-policy.entity';
import { Datasource } from '../entities/datasource.entity';

@ApiTags('Country Policies')
@Controller('country-policies')
export class CountryPolicyController {
  private readonly logger = new Logger(CountryPolicyController.name);

  constructor(
    private readonly countryPolicyService: CountryPolicyService,
  ) {}

  @Get('countries')
  @ApiOperation({ summary: 'Get all countries with their active policies' })
  @ApiResponse({ status: 200, description: 'List of countries with active policies' })
  async getAllCountries(): Promise<Country[]> {
    return this.countryPolicyService.findAllCountries();
  }

  @Get('countries/:id')
  @ApiOperation({ summary: 'Get country by ID with full details' })
  @ApiParam({ name: 'id', type: 'number', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'Country details' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async getCountryById(@Param('id', ParseIntPipe) id: number): Promise<Country> {
    return this.countryPolicyService.findCountryById(id);
  }

  @Get('countries/name/:name')
  @ApiOperation({ summary: 'Get country by name' })
  @ApiParam({ name: 'name', type: 'string', description: 'Country name' })
  @ApiResponse({ status: 200, description: 'Country details' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  async getCountryByName(@Param('name') name: string): Promise<Country> {
    return this.countryPolicyService.findCountryByName(name);
  }

  @Get('countries/:id/active-policy')
  @ApiOperation({ summary: 'Get active policy for a country' })
  @ApiParam({ name: 'id', type: 'number', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'Active policy details' })
  @ApiResponse({ status: 404, description: 'Country or active policy not found' })
  async getActivePolicy(@Param('id', ParseIntPipe) countryId: number): Promise<CountryPolicy> {
    return this.countryPolicyService.getActivePolicy(countryId);
  }

  @Get('countries/:id/versions')
  @ApiOperation({ summary: 'Get all versions for a country' })
  @ApiParam({ name: 'id', type: 'number', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'List of country versions' })
  async getCountryVersions(@Param('id', ParseIntPipe) countryId: number): Promise<Version[]> {
    return this.countryPolicyService.getCountryVersions(countryId);
  }

  @Get('countries/:id/versions/:versionId')
  @ApiOperation({ summary: 'Get specific version with policies' })
  @ApiParam({ name: 'id', type: 'number', description: 'Country ID' })
  @ApiParam({ name: 'versionId', type: 'string', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Version with policies' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async getVersionWithPolicies(
    @Param('id', ParseIntPipe) countryId: number,
    @Param('versionId') versionId: string,
  ): Promise<Version> {
    return this.countryPolicyService.getVersionWithPolicies(countryId, versionId);
  }

  @Put('countries/:id/active-policy')
  @ApiOperation({ summary: 'Set active policy for a country' })
  @ApiParam({ name: 'id', type: 'number', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'Country with updated active policy' })
  @ApiResponse({ status: 404, description: 'Country or policy not found' })
  async setActivePolicy(
    @Param('id', ParseIntPipe) countryId: number,
    @Body('policyId', ParseIntPipe) policyId: number,
  ): Promise<Country> {
    return this.countryPolicyService.setActivePolicy(countryId, policyId);
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get policy by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'Policy ID' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async getPolicyById(@Param('id', ParseIntPipe) policyId: number): Promise<CountryPolicy> {
    return this.countryPolicyService.getPolicyById(policyId);
  }

  @Get('countries/:id/datasources')
  @ApiOperation({ summary: 'Get all datasources for a country' })
  @ApiParam({ name: 'id', type: 'number', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'List of country datasources' })
  async getCountryDatasources(@Param('id', ParseIntPipe) countryId: number): Promise<Datasource[]> {
    return this.countryPolicyService.getCountryDatasources(countryId);
  }

  @Get('data-integrity')
  @ApiOperation({
    summary: 'Validate country policy data integrity',
    description: 'Check data integrity for country policies and compliance rules. For overall system health, use GET /health'
  })
  @ApiResponse({ status: 200, description: 'Data integrity validation results' })
  async validateDataIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    summary: {
      totalCountries: number;
      activeCountries: number;
      countriesWithPolicies: number;
      totalVersions: number;
      totalPolicies: number;
    };
  }> {
    return this.countryPolicyService.validateDataIntegrity();
  }
}
