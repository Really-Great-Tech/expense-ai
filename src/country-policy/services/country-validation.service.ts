import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../entities/country.entity';

@Injectable()
export class CountryValidationService {
  private readonly logger = new Logger(CountryValidationService.name);
  private validationCache = new Map<string, { value: boolean; timestamp: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  /**
   * Check if a country name is valid and active
   */
  async isValidCountry(countryName: string): Promise<boolean> {
    if (!countryName?.trim()) {
      return false;
    }

    const normalizedName = countryName.trim();
    const cacheKey = `valid:${normalizedName.toLowerCase()}`;

    try {
      // Check cache first
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.value;
      }

      // Query database
      const country = await this.countryRepository.findOne({
        where: { name: normalizedName, active: true },
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
}
