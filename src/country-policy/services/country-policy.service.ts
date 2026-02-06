import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Country } from '../entities/country.entity';
import { CountryPolicy } from '../entities/country-policy.entity';
import { Version } from '../entities/version.entity';
import { Datasource } from '../entities/datasource.entity';

@Injectable()
export class CountryPolicyService {
  private readonly logger = new Logger(CountryPolicyService.name);

  constructor(
    @InjectRepository(Country)
    private countryRepository: Repository<Country>,
    @InjectRepository(CountryPolicy)
    private policyRepository: Repository<CountryPolicy>,
    @InjectRepository(Version)
    private versionRepository: Repository<Version>,
    @InjectRepository(Datasource)
    private datasourceRepository: Repository<Datasource>,
    private dataSource: DataSource,
  ) { }

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

  /**
   * Delete country and all associated data (Policies, Versions, Datasources)
   * Uses a transaction to ensure atomicity
   */
  async deleteCountry(name: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Attempting to delete country: ${name}`);

      // 1. Find the country
      const country = await this.countryRepository.findOne({
        where: { name },
      });

      if (!country) {
        throw new NotFoundException(`Country with name ${name} not found`);
      }

      this.logger.log(`Found country ID: ${country.id}. Starting cascading delete...`);

      // 1.5 Break circular dependency (FK constraint)
      // The country points to an active policy, so we must nullify this before deleting policies
      await queryRunner.manager.update(Country, country.id, { activePolicyId: null });
      this.logger.log(`Set activePolicyId to null for country ${name}`);

      // 2. Delete Datasources
      const deletedDatasources = await queryRunner.manager.delete(Datasource, { countryId: country.id });
      this.logger.log(`Deleted ${deletedDatasources.affected} datasources`);

      // 3. Delete Policies
      // Need to find policies linked to this country's versions
      // But since we can query by versionCountryId (which is the countryId), we can delete directly
      const deletedPolicies = await queryRunner.manager.delete(CountryPolicy, { versionCountryId: country.id });
      this.logger.log(`Deleted ${deletedPolicies.affected} policies`);

      // 4. Delete Versions
      const deletedVersions = await queryRunner.manager.delete(Version, { countryId: country.id });
      this.logger.log(`Deleted ${deletedVersions.affected} versions`);

      // 5. Delete Country
      await queryRunner.manager.delete(Country, { id: country.id });
      this.logger.log(`Deleted country record`);

      await queryRunner.commitTransaction();
      this.logger.log(`Successfully deleted country ${name} and all associated data.`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to delete country ${name}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
