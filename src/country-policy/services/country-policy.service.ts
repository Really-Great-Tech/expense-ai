import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../entities/country.entity';

@Injectable()
export class CountryPolicyService {
  private readonly logger = new Logger(CountryPolicyService.name);

  constructor(
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
  ) {}

  /**
   * Get country by name with active policy
   */
  async findCountryByName(name: string): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { name },
      relations: ['activePolicy'],
    });

    if (!country) {
      throw new NotFoundException(`Country with name ${name} not found`);
    }

    return country;
  }
}
