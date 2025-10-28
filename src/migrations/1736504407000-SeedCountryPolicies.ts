import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';
import { MigrationHelper } from '../country-policy/utils/migration-helper';

export class SeedCountryPolicies1736504407000 implements MigrationInterface {
  name = 'SeedCountryPolicies1736504407000';
  private readonly logger = new Logger(SeedCountryPolicies1736504407000.name);

  public async up(queryRunner: QueryRunner): Promise<void> {
    this.logger.log('Starting Country Policies Seeding Migration...');

    try {
      // Seed all countries from the country_seed directory
      await MigrationHelper.seedAllCountries(queryRunner);

      // Validate the seeded data
      const isValid = await MigrationHelper.validateSeededData(queryRunner);
      if (!isValid) {
        throw new Error('Data validation failed after seeding');
      }

      this.logger.log('Country Policies Seeding Migration completed successfully');
    } catch (error) {
      this.logger.error(
        `Country Policies Seeding Migration failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      
      // Attempt to clean up on failure
      try {
        await this.down(queryRunner);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clean up after migration failure: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      
      throw error;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    this.logger.log('Rolling back Country Policies Seeding Migration...');

    try {
      await MigrationHelper.removeAllCountryPolicies(queryRunner);
      this.logger.log('Country Policies Seeding Migration rollback completed successfully');
    } catch (error) {
      this.logger.error(
        `Country Policies Seeding Migration rollback failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
