import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../entities/country.entity';
import { Version } from '../entities/version.entity';
import { CountryPolicy } from '../entities/country-policy.entity';
import { Datasource } from '../entities/datasource.entity';

@Injectable()
export class CountryPolicyService {
  private readonly logger = new Logger(CountryPolicyService.name);

  constructor(
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @InjectRepository(Version)
    private versionRepository: Repository<Version>,
    @InjectRepository(CountryPolicy)
    private countryPolicyRepository: Repository<CountryPolicy>,
    @InjectRepository(Datasource)
    private datasourceRepository: Repository<Datasource>,
  ) {}

  /**
   * Get all countries with their active policies
   */
  async findAllCountries(): Promise<Country[]> {
    return this.countryRepository.find({
      relations: ['activePolicy', 'versions', 'datasources'],
      where: { active: true },
    });
  }

  /**
   * Get country by ID with full relations
   */
  async findCountryById(id: number): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { id },
      relations: ['activePolicy', 'versions', 'datasources'],
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }

    return country;
  }

  /**
   * Get country by name
   */
  async findCountryByName(name: string): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { name },
      relations: ['activePolicy', 'versions', 'datasources'],
    });

    if (!country) {
      throw new NotFoundException(`Country with name ${name} not found`);
    }

    return country;
  }

  /**
   * Get active policy for a country
   */
  async getActivePolicy(countryId: number): Promise<CountryPolicy> {
    const country = await this.countryRepository.findOne({
      where: { id: countryId },
      relations: ['activePolicy'],
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${countryId} not found`);
    }

    if (!country.activePolicy) {
      throw new NotFoundException(`No active policy found for country ${countryId}`);
    }

    return country.activePolicy;
  }

  /**
   * Get all versions for a country
   */
  async getCountryVersions(countryId: number): Promise<Version[]> {
    const country = await this.findCountryById(countryId);
    
    return this.versionRepository.find({
      where: { countryId },
      relations: ['policies', 'datasources'],
      order: { versionId: 'DESC' },
    });
  }

  /**
   * Get specific version with policies
   */
  async getVersionWithPolicies(countryId: number, versionId: string): Promise<Version> {
    const version = await this.versionRepository.findOne({
      where: { countryId, versionId },
      relations: ['policies', 'datasources', 'country'],
    });

    if (!version) {
      throw new NotFoundException(`Version ${versionId} not found for country ${countryId}`);
    }

    return version;
  }

  /**
   * Set active policy for a country
   */
  async setActivePolicy(countryId: number, policyId: number): Promise<Country> {
    const country = await this.findCountryById(countryId);
    
    // Verify the policy exists and belongs to this country
    const policy = await this.countryPolicyRepository.findOne({
      where: { id: policyId, versionCountryId: countryId },
    });

    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found for country ${countryId}`);
    }

    country.activePolicyId = policyId;
    await this.countryRepository.save(country);

    return this.findCountryById(countryId);
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(policyId: number): Promise<CountryPolicy> {
    const policy = await this.countryPolicyRepository.findOne({
      where: { id: policyId },
      relations: ['version'],
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    return policy;
  }

  /**
   * Get all datasources for a country
   */
  async getCountryDatasources(countryId: number): Promise<Datasource[]> {
    return this.datasourceRepository.find({
      where: { countryId },
      relations: ['country', 'version'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Health check - validate data integrity
   */
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
    const issues: string[] = [];
    
    // Get counts
    const totalCountries = await this.countryRepository.count();
    const activeCountries = await this.countryRepository.count({ where: { active: true } });
    const countriesWithPolicies = await this.countryRepository.count({ 
      where: { activePolicyId: { $ne: null } as any } 
    });
    const totalVersions = await this.versionRepository.count();
    const totalPolicies = await this.countryPolicyRepository.count();

    // Check for countries without active policies
    const countriesWithoutPolicies = await this.countryRepository.find({
      where: { active: true, activePolicyId: null },
    });
    
    if (countriesWithoutPolicies.length > 0) {
      issues.push(`${countriesWithoutPolicies.length} active countries without policies: ${countriesWithoutPolicies.map(c => c.name).join(', ')}`);
    }

    // Check for orphaned policies
    const orphanedPolicies = await this.countryPolicyRepository
      .createQueryBuilder('policy')
      .leftJoin('versions', 'version', 'policy.version_country_id = version.country_id AND policy.version_id = version.version_id')
      .where('version.country_id IS NULL')
      .getCount();

    if (orphanedPolicies > 0) {
      issues.push(`${orphanedPolicies} orphaned policies found`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      summary: {
        totalCountries,
        activeCountries,
        countriesWithPolicies,
        totalVersions,
        totalPolicies,
      },
    };
  }
}
