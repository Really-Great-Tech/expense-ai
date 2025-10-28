import { QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';
import { DataTransformer, TransformedPolicyRules } from './data-transformer';

export class MigrationHelper {
  private static readonly logger = new Logger(MigrationHelper.name);
  /**
   * Seed a single country with its policy data
   */
  static async seedCountry(
    queryRunner: QueryRunner,
    countryName: string,
    versionId: string = DataTransformer.generateVersionId()
  ): Promise<{ countryId: number; versionCountryId: number; policyId: number }> {
    this.logger.log(`Seeding country: ${countryName}`);

    // Load and transform country data
    const seedData = await DataTransformer.loadCountryData(countryName);
    const transformedRules = DataTransformer.transformSeedToEntityFormat(seedData);
    
    // Debug: Verify the transformed rules are serializable
    this.logger.log(`Transformed rules for ${countryName}: ${JSON.stringify(transformedRules, null, 2)}`);

    // 1. Insert or get country
    const countryResult = await queryRunner.query(
      'SELECT id FROM countries WHERE name = ?',
      [countryName]
    );

    let countryId: number;
    if (countryResult.length === 0) {
      const insertResult = await queryRunner.query(
        'INSERT INTO countries (name, active, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
        [countryName, true]
      );
      countryId = insertResult.insertId;
    } else {
      countryId = countryResult[0].id;
    }

    // 2. Insert or get version
    const versionResult = await queryRunner.query(
      'SELECT country_id FROM versions WHERE country_id = ? AND version_id = ?',
      [countryId, versionId]
    );

    if (versionResult.length === 0) {
      await queryRunner.query(
        'INSERT INTO versions (country_id, version_id, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
        [countryId, versionId]
      );
    }

    // 3. Check if policy already exists for this version
    const existingPolicy = await queryRunner.query(
      'SELECT id FROM country_policies WHERE version_country_id = ? AND version_id = ?',
      [countryId, versionId]
    );

    let policyId: number;
    if (existingPolicy.length === 0) {
      // Insert new policy
      const policyResult = await queryRunner.query(
        'INSERT INTO country_policies (rules, version_country_id, version_id, createdAt, updatedAt) VALUES (CAST(? AS JSON), ?, ?, NOW(), NOW())',
        [JSON.stringify(transformedRules), countryId, versionId]
      );
      policyId = policyResult.insertId;
    } else {
      // Update existing policy
      policyId = existingPolicy[0].id;
      await queryRunner.query(
        'UPDATE country_policies SET rules = CAST(? AS JSON), updatedAt = NOW() WHERE id = ?',
        [JSON.stringify(transformedRules), policyId]
      );
    }

    // 4. Update country's active policy
    await queryRunner.query(
      'UPDATE countries SET active_policy_id = ?, updatedAt = NOW() WHERE id = ?',
      [policyId, countryId]
    );

    // 5. Insert datasource record
    const datasourceResult = await queryRunner.query(
      'SELECT id FROM datasources WHERE country_id = ? AND version_country_id = ? AND version_id = ? AND source = ?',
      [countryId, countryId, versionId, `country_seed/${countryName.toLowerCase()}.json`]
    );

    if (datasourceResult.length === 0) {
      await queryRunner.query(
        'INSERT INTO datasources (type, source, country_id, version_country_id, version_id, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        ['file', `country_seed/${countryName.toLowerCase()}.json`, countryId, countryId, versionId]
      );
    }

    this.logger.log(`Successfully seeded ${countryName} with version ${versionId}`);
    return { countryId, versionCountryId: countryId, policyId };
  }

  /**
   * Seed all available countries
   */
  static async seedAllCountries(
    queryRunner: QueryRunner,
    versionId: string = DataTransformer.generateVersionId()
  ): Promise<void> {
    try {
      const countries = DataTransformer.getAvailableCountries();
      this.logger.log(`Found ${countries.length} countries to seed: ${JSON.stringify(countries)}`);

      for (const country of countries) {
        try {
          await this.seedCountry(queryRunner, country, versionId);
        } catch (error) {
          this.logger.error(
            `Failed to seed ${country}: ${error instanceof Error ? error.message : error}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error; // Re-throw to fail the migration
        }
      }

      this.logger.log(`Successfully seeded ${countries.length} countries`);
    } catch (error) {
      this.logger.error(
        `Failed to seed countries: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Remove all country policy data (for migration rollback)
   */
  static async removeAllCountryPolicies(queryRunner: QueryRunner): Promise<void> {
    this.logger.log('Removing all country policy data...');

    // Remove in reverse order due to foreign key constraints
    await queryRunner.query('DELETE FROM datasources');
    await queryRunner.query('UPDATE countries SET active_policy_id = NULL');
    await queryRunner.query('DELETE FROM country_policies');
    await queryRunner.query('DELETE FROM versions');
    await queryRunner.query('DELETE FROM countries');

    this.logger.log('All country policy data removed');
  }

  /**
   * Validate seeded data integrity
   */
  static async validateSeededData(queryRunner: QueryRunner): Promise<boolean> {
    try {
      // Check if all countries have active policies
      const countriesWithoutPolicies = await queryRunner.query(
        'SELECT name FROM countries WHERE active_policy_id IS NULL'
      );

      if (countriesWithoutPolicies.length > 0) {
        this.logger.error(`Countries without active policies: ${JSON.stringify(countriesWithoutPolicies.map((c) => c.name))}`);
        return false;
      }

      // Check if all policies have valid JSON rules
      const policies = await queryRunner.query('SELECT id, rules FROM country_policies');
      for (const policy of policies) {
        try {
          const rules = policy.rules;
          // MySQL JSON columns may be returned as parsed objects by the driver.
          // Accept both string and object forms and ensure data is serializable JSON.
          if (typeof rules === 'string') {
            JSON.parse(rules);
          } else if (typeof rules === 'object' && rules !== null) {
            // Ensure it can be serialized back to JSON
            JSON.stringify(rules);
          } else {
            throw new Error(`Unexpected rules type: ${typeof rules}`);
          }
        } catch (error) {
          this.logger.error(
            `Invalid JSON in policy ${policy.id}: ${error instanceof Error ? error.message : error}`,
            error instanceof Error ? error.stack : undefined,
          );
          return false;
        }
      }

      // Check if all versions are properly linked
      const orphanedVersions = await queryRunner.query(`
        SELECT v.country_id, v.version_id 
        FROM versions v 
        LEFT JOIN countries c ON v.country_id = c.id 
        WHERE c.id IS NULL
      `);

      if (orphanedVersions.length > 0) {
        this.logger.error(`Orphaned versions found: ${JSON.stringify(orphanedVersions)}`);
        return false;
      }

      this.logger.log('Data validation passed');
      return true;
    } catch (error) {
      this.logger.error(
        `Data validation failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
