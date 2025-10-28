import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MigrationHelper } from '../utils/migration-helper';
import { DataTransformer } from '../utils/data-transformer';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Seed all countries (delegates to migration helper)
   * This method is provided for convenience but production seeding
   * should be done via migrations: npm run migration:run
   */
  async seedAllCountries(versionId?: string): Promise<void> {
    this.logger.warn('Using SeedService.seedAllCountries() - Consider using migrations instead');
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await MigrationHelper.seedAllCountries(queryRunner, versionId);
      await queryRunner.commitTransaction();
      this.logger.log('Countries seeded successfully via SeedService');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to seed countries via SeedService', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Seed a specific country
   */
  async seedCountry(countryName: string, versionId?: string): Promise<void> {
    this.logger.log(`Seeding country: ${countryName}`);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await MigrationHelper.seedCountry(queryRunner, countryName, versionId);
      await queryRunner.commitTransaction();
      this.logger.log(`Country ${countryName} seeded successfully`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to seed country ${countryName}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get available countries for seeding
   */
  getAvailableCountries(): string[] {
    return DataTransformer.getAvailableCountries();
  }

  /**
   * Validate seeded data integrity
   */
  async validateData(): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      return await MigrationHelper.validateSeededData(queryRunner);
    } catch (error) {
      this.logger.error('Data validation failed', error);
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get migration status for country policies
   */
  async getMigrationStatus(): Promise<{
    isSeeded: boolean;
    availableCountries: string[];
    seededCountries: number;
    lastSeededVersion?: string;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const availableCountries = this.getAvailableCountries();
      const seededCountries = await queryRunner.query('SELECT COUNT(*) as count FROM countries');
      const lastVersion = await queryRunner.query(
        'SELECT version_id FROM versions ORDER BY created_at DESC LIMIT 1'
      );

      return {
        isSeeded: seededCountries[0]?.count > 0,
        availableCountries,
        seededCountries: seededCountries[0]?.count || 0,
        lastSeededVersion: lastVersion[0]?.version_id,
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
