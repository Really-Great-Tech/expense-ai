import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../entities/country.entity';

export interface CreateCountryDto {
  name: string;
  code?: string;
  active?: boolean;
}

export interface UpdateCountryDto {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CountryQueryOptions {
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class CountryValidationService {
  private readonly logger = new Logger(CountryValidationService.name);
  // Simple in-memory cache for validation results
  private validationCache = new Map<string, { value: boolean; timestamp: number }>();
  private countryCache = new Map<string, { value: Country | null; timestamp: number }>();
  private activeCountriesCache: { value: Country[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 300000; // 5 minutes in milliseconds

  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  // Core validation methods
  async isValidCountry(countryName: string): Promise<boolean> {
    if (!countryName?.trim()) {
      return false;
    }

    const normalizedName = countryName.trim();
    const cacheKey = `valid:${normalizedName.toLowerCase()}`;

    try {
      // Check cache first
      const cached = this.validationCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        return cached.value;
      }

      // Query database with case-insensitive search
      const country = await this.countryRepository.findOne({
        where: {
          name: normalizedName,
          active: true
        }
      });

      const isValid = !!country;

      // Cache the result
      this.validationCache.set(cacheKey, { value: isValid, timestamp: Date.now() });

      return isValid;

    } catch (error) {
      this.logger.error(`Country validation failed for ${normalizedName}:`, error);
      return false;
    }
  }

  async findByName(name: string): Promise<Country | null> {
    if (!name?.trim()) {
      return null;
    }

    const normalizedName = name.trim();
    const cacheKey = `name:${normalizedName.toLowerCase()}`;

    try {
      const cached = this.countryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        return cached.value;
      }

      const country = await this.countryRepository.findOne({
        where: { name: normalizedName }
      });

      // Cache the result
      this.countryCache.set(cacheKey, { value: country, timestamp: Date.now() });

      return country;

    } catch (error) {
      this.logger.error(`Find by name failed for ${normalizedName}:`, error);
      return null;
    }
  }

  async findActiveCountries(): Promise<Country[]> {
    try {
      // Check cache first
      if (this.activeCountriesCache && (Date.now() - this.activeCountriesCache.timestamp) < this.CACHE_TTL) {
        return this.activeCountriesCache.value;
      }

      const countries = await this.countryRepository.find({
        where: { active: true },
        order: { name: 'ASC' }
      });

      // Cache the result
      this.activeCountriesCache = { value: countries, timestamp: Date.now() };

      return countries;

    } catch (error) {
      this.logger.error('Failed to find active countries:', error);
      return [];
    }
  }

  // CRUD operations
  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    try {
      // Check for existing country with same name
      const existing = await this.findByName(createCountryDto.name);
      if (existing) {
        throw new ConflictException(`Country with name '${createCountryDto.name}' already exists`);
      }

      const country = this.countryRepository.create({
        ...createCountryDto,
        active: createCountryDto.active ?? true
      });
      const savedCountry = await this.countryRepository.save(country);

      // Invalidate relevant cache entries
      this.invalidateCountryCache();

      this.logger.log(`Country created: ${savedCountry.name} (ID: ${savedCountry.id})`);
      return savedCountry;

    } catch (error) {
      this.logger.error(`Failed to create country:`, error);
      throw error;
    }
  }

  async findAll(options?: CountryQueryOptions): Promise<Country[]> {
    try {
      const queryBuilder = this.countryRepository.createQueryBuilder('country');
      
      if (options?.active !== undefined) {
        queryBuilder.andWhere('country.active = :active', { active: options.active });
      }

      if (options?.search) {
        queryBuilder.andWhere(
          '(LOWER(country.name) LIKE LOWER(:search) OR LOWER(country.code) LIKE LOWER(:search))',
          { search: `%${options.search}%` }
        );
      }

      queryBuilder.orderBy('country.name', 'ASC');

      if (options?.limit) {
        queryBuilder.limit(options.limit);
      }

      if (options?.offset) {
        queryBuilder.offset(options.offset);
      }

      return await queryBuilder.getMany();

    } catch (error) {
      this.logger.error('Failed to find countries:', error);
      throw error;
    }
  }

  async findOne(id: number): Promise<Country> {
    try {
      const country = await this.countryRepository.findOne({
        where: { id }
      });

      if (!country) {
        throw new NotFoundException(`Country with ID ${id} not found`);
      }

      return country;

    } catch (error) {
      this.logger.error(`Failed to find country ${id}:`, error);
      throw error;
    }
  }

  async update(id: number, updateCountryDto: UpdateCountryDto): Promise<Country> {
    try {
      const country = await this.countryRepository.findOne({ where: { id } });
      if (!country) {
        throw new NotFoundException(`Country with ID ${id} not found`);
      }

      // Check for name conflicts if name is being updated
      if (updateCountryDto.name && updateCountryDto.name !== country.name) {
        const existing = await this.findByName(updateCountryDto.name);
        if (existing && existing.id !== id) {
          throw new ConflictException(`Country with name '${updateCountryDto.name}' already exists`);
        }
      }

      Object.assign(country, updateCountryDto);
      const updatedCountry = await this.countryRepository.save(country);

      // Invalidate cache
      this.invalidateCountryCache();

      this.logger.log(`Country updated: ${updatedCountry.name} (ID: ${updatedCountry.id})`);
      return updatedCountry;

    } catch (error) {
      this.logger.error(`Failed to update country ${id}:`, error);
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const country = await this.findOne(id);
      await this.countryRepository.remove(country);
      
      // Invalidate cache
      this.invalidateCountryCache();

      this.logger.log(`Country deleted: ${country.name} (ID: ${id})`);

    } catch (error) {
      this.logger.error(`Failed to delete country ${id}:`, error);
      throw error;
    }
  }

  // Administrative methods
  async activateCountry(id: number): Promise<Country> {
    return this.update(id, { active: true });
  }

  async deactivateCountry(id: number): Promise<Country> {
    return this.update(id, { active: false });
  }

  async bulkImport(countries: CreateCountryDto[]): Promise<Country[]> {
    const results: Country[] = [];

    try {
      for (const countryDto of countries) {
        try {
          const country = await this.create(countryDto);
          results.push(country);
        } catch (error) {
          this.logger.warn(`Failed to import country ${countryDto.name}: ${error.message}`);
        }
      }

      this.logger.log(`Bulk import completed: ${results.length}/${countries.length} countries imported`);
      return results;

    } catch (error) {
      this.logger.error('Bulk import failed:', error);
      throw error;
    }
  }

  private invalidateCountryCache(): void {
    try {
      // Clear all cache entries
      this.validationCache.clear();
      this.countryCache.clear();
      this.activeCountriesCache = null;

    } catch (error) {
      this.logger.warn('Failed to invalidate country cache:', error);
    }
  }
}
