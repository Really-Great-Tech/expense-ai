import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  ParseIntPipe,
  NotFoundException,
  ConflictException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiExcludeController } from '@nestjs/swagger';
import { CountryValidationService } from '../services/country-validation.service';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-country.dto';
import { CountryQueryDto } from '../dto/country-query.dto';
import { Country } from '../entities/country.entity';

@ApiExcludeController()
@ApiTags('country-management')
@Controller('countries')
export class CountryManagementController {
  private readonly logger = new Logger(CountryManagementController.name);

  constructor(private readonly countryValidationService: CountryValidationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new country' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Country created successfully', 
    type: Country 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Country already exists' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  async create(@Body() createCountryDto: CreateCountryDto): Promise<Country> {
    this.logger.log(`Creating country: ${createCountryDto.name}`);
    return await this.countryValidationService.create(createCountryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all countries with optional filtering' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by country name or code' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Countries retrieved successfully', 
    type: [Country] 
  })
  async findAll(@Query() query: CountryQueryDto): Promise<Country[]> {
    this.logger.log(`Fetching countries with query: ${JSON.stringify(query)}`);
    
    if (query.active === true) {
      return await this.countryValidationService.findActiveCountries();
    }
    
    return await this.countryValidationService.findAll(query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active countries' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Active countries retrieved successfully', 
    type: [Country] 
  })
  async findActiveCountries(): Promise<Country[]> {
    this.logger.log('Fetching all active countries');
    return await this.countryValidationService.findActiveCountries();
  }

  @Get('validate/:name')
  @ApiOperation({ summary: 'Validate if a country name is valid and active' })
  @ApiParam({ name: 'name', description: 'Country name to validate', example: 'Germany' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Validation result', 
    schema: { 
      type: 'object', 
      properties: { 
        isValid: { type: 'boolean' },
        countryName: { type: 'string' }
      }
    }
  })
  async validateCountry(@Param('name') name: string): Promise<{ isValid: boolean; countryName: string }> {
    this.logger.log(`Validating country: ${name}`);
    const isValid = await this.countryValidationService.isValidCountry(name);
    return { isValid, countryName: name };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get country by ID' })
  @ApiParam({ name: 'id', description: 'Country ID', example: 1 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Country found', 
    type: Country 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Country not found' 
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Country> {
    this.logger.log(`Fetching country with ID: ${id}`);
    return await this.countryValidationService.findOne(id);
  }

  @Get('name/:name')
  @ApiOperation({ summary: 'Get country by name' })
  @ApiParam({ name: 'name', description: 'Country name', example: 'Germany' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Country found', 
    type: Country 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Country not found' 
  })
  async findByName(@Param('name') name: string): Promise<Country> {
    this.logger.log(`Fetching country by name: ${name}`);
    const country = await this.countryValidationService.findByName(name);
    if (!country) {
      throw new NotFoundException(`Country with name '${name}' not found`);
    }
    return country;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update country' })
  @ApiParam({ name: 'id', description: 'Country ID', example: 1 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Country updated successfully', 
    type: Country 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Country not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Country name already exists' 
  })
  async update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCountryDto: UpdateCountryDto
  ): Promise<Country> {
    this.logger.log(`Updating country ID ${id}: ${JSON.stringify(updateCountryDto)}`);
    return await this.countryValidationService.update(id, updateCountryDto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate country' })
  @ApiParam({ name: 'id', description: 'Country ID', example: 1 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Country activated successfully', 
    type: Country 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Country not found' 
  })
  async activate(@Param('id', ParseIntPipe) id: number): Promise<Country> {
    this.logger.log(`Activating country ID: ${id}`);
    return await this.countryValidationService.activateCountry(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate country' })
  @ApiParam({ name: 'id', description: 'Country ID', example: 1 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Country deactivated successfully', 
    type: Country 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Country not found' 
  })
  async deactivate(@Param('id', ParseIntPipe) id: number): Promise<Country> {
    this.logger.log(`Deactivating country ID: ${id}`);
    return await this.countryValidationService.deactivateCountry(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete country (soft delete by deactivating)' })
  @ApiParam({ name: 'id', description: 'Country ID', example: 1 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Country deleted (deactivated) successfully',
    type: Country
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Country not found' 
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<Country> {
    this.logger.log(`Soft deleting (deactivating) country ID: ${id}`);
    // Implement soft delete by deactivating instead of hard delete
    return await this.countryValidationService.deactivateCountry(id);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import countries' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Countries imported successfully', 
    type: [Country] 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data or import errors' 
  })
  async bulkImport(@Body() countries: CreateCountryDto[]): Promise<{
    imported: Country[];
    totalRequested: number;
    totalImported: number;
    errors: string[];
  }> {
    this.logger.log(`Bulk importing ${countries.length} countries`);
    
    try {
      const imported = await this.countryValidationService.bulkImport(countries);
      
      return {
        imported,
        totalRequested: countries.length,
        totalImported: imported.length,
        errors: countries.length > imported.length 
          ? [`${countries.length - imported.length} countries failed to import (see logs for details)`]
          : []
      };
    } catch (error) {
      this.logger.error('Bulk import failed:', error);
      throw error;
    }
  }
}
