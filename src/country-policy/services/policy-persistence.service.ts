import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Country } from '../entities/country.entity';
import { Version } from '../entities/version.entity';
import { CountryPolicy } from '../entities/country-policy.entity';
import { Datasource } from '../entities/datasource.entity';
import {
  ExtractedPolicyData,
  StoredFileInfo,
  PolicySaveResult,
} from '../interfaces/policy-types.interface';

/**
 * ============================================================================
 * POLICY PERSISTENCE SERVICE
 * ============================================================================
 * 
 * Saves extracted policy data to database using the same logic as:
 * src/migrations/1736504407000-SeedCountryPolicies.ts
 * 
 * Uses transactions to ensure atomic operations across:
 * 1. countries (insert/update)
 * 2. versions (insert)
 * 3. country_policies (insert with JSON rules)
 * 4. datasources (insert for file tracking)
 * 5. countries (update active_policy_id)
 * ============================================================================
 */

@Injectable()
export class PolicyPersistenceService {
  private readonly logger = new Logger(PolicyPersistenceService.name);

  constructor(
    @InjectRepository(Country)
    private readonly countryRepo: Repository<Country>,
    @InjectRepository(Version)
    private readonly versionRepo: Repository<Version>,
    @InjectRepository(CountryPolicy)
    private readonly policyRepo: Repository<CountryPolicy>,
    @InjectRepository(Datasource)
    private readonly datasourceRepo: Repository<Datasource>,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Save extracted policy to database within a transaction
   */
  async savePolicyToDatabase(
    countryName: string,
    policyData: ExtractedPolicyData,
    fileInfo: StoredFileInfo,
    countryCode?: string,
  ): Promise<PolicySaveResult> {

    this.logger.log('============================================');
    this.logger.log('💾 DATABASE SAVE STARTING');
    this.logger.log('============================================');
    this.logger.log(`🌍 Country: ${countryName}`);
    this.logger.log(`🏷️  Code: ${countryCode || 'auto-derived'}`);
    this.logger.log(`📄 Source file: ${fileInfo.fileName}`);
    this.logger.log(`📋 Receipt standards: ${policyData.receiptStandards.length}`);
    this.logger.log(`💰 Gross-up policies: ${policyData.compliancePoliciesGrossUpRelated.length}`);
    this.logger.log(`📝 Additional info policies: ${policyData.compliancePoliciesAdditionalInfoRelated.length}`);
    this.logger.log('');

    // Generate version ID (same format as migration)
    const versionId = this.generateVersionId();
    const derivedCode = countryCode || this.getCountryCode(countryName);

    // Run all operations in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1: Check if country exists
      let country = await queryRunner.manager.findOne(Country, {
        where: { name: countryName },
      });

      if (country) {
        this.logger.log(`   ✓ Found existing country: ${countryName} (ID: ${country.id})`);
      } else {
        // Create new country
        country = queryRunner.manager.create(Country, {
          name: countryName,
          code: derivedCode,
          active: true,
        });
        country = await queryRunner.manager.save(Country, country);
        this.logger.log(`   ✓ Created new country: ${countryName} (ID: ${country.id})`);
      }

      // Step 2: Create version
      const version = queryRunner.manager.create(Version, {
        countryId: country.id,
        versionId: versionId,
      });
      await queryRunner.manager.save(Version, version);
      this.logger.log(`   ✓ Created version: ${versionId}`);

      // Step 3: Create policy with JSON rules
      // TypeORM handles JSON serialization automatically for JSON columns
      const rules = {
        receiptStandards: policyData.receiptStandards,
        compliancePoliciesGrossUpRelated: policyData.compliancePoliciesGrossUpRelated,
        compliancePoliciesAdditionalInfoRelated: policyData.compliancePoliciesAdditionalInfoRelated,
      };

      const policy = queryRunner.manager.create(CountryPolicy, {
        rules: rules as any, // TypeORM JSON column handles serialization
        versionCountryId: country.id,
        versionId: versionId,
      });
      const savedPolicy = await queryRunner.manager.save(CountryPolicy, policy);
      this.logger.log(`   ✓ Created policy (ID: ${savedPolicy.id})`);

      // Step 4: Create datasource record
      const datasource = queryRunner.manager.create(Datasource, {
        type: fileInfo.fileType,
        source: fileInfo.filePath,
        content: fileInfo.rawContent || null,
        countryId: country.id,
        versionCountryId: country.id,
        versionId: versionId,
      });
      const savedDatasource = await queryRunner.manager.save(Datasource, datasource);
      this.logger.log(`   ✓ Created datasource (ID: ${savedDatasource.id})`);

      // Step 5: Update country's active policy
      await queryRunner.manager.update(Country, country.id, {
        activePolicyId: savedPolicy.id,
      });
      this.logger.log(`   ✓ Updated country active policy`);

      // Commit transaction
      await queryRunner.commitTransaction();

      this.logger.log('');
      this.logger.log('============================================');
      this.logger.log('✅ DATABASE SAVE COMPLETE');
      this.logger.log('============================================');
      this.logger.log('');

      return {
        success: true,
        countryId: country.id,
        countryCode: derivedCode,
        versionId: versionId,
        policyId: savedPolicy.id,
        datasourceId: savedDatasource.id,
      };

    } catch (error) {
      // Rollback on any error
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Database save failed, transaction rolled back:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate version ID in format: v{year}.{month}.{day}
   */
  private generateVersionId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `v${year}.${month}.${day}`;
  }

  /**
   * Get country code from country name (ISO 3166-1 alpha-2)
   */
  private getCountryCode(countryName: string): string {
    const codes: Record<string, string> = {
      Austria: 'AT',
      Belgium: 'BE',
      China: 'CN',
      France: 'FR',
      Germany: 'DE',
      Indonesia: 'ID',
      Italy: 'IT',
      Japan: 'JP',
      Poland: 'PL',
      'South Korea': 'KR',
      Spain: 'ES',
      Switzerland: 'CH',
      Taiwan: 'TW',
      Thailand: 'TH',
      Vietnam: 'VN',
      Netherlands: 'NL',
      'United Kingdom': 'GB',
      'United States': 'US',
      Singapore: 'SG',
      Malaysia: 'MY',
      Philippines: 'PH',
      India: 'IN',
      Australia: 'AU',
      'New Zealand': 'NZ',
      Canada: 'CA',
      Mexico: 'MX',
      Brazil: 'BR',
    };

    return codes[countryName] || countryName.substring(0, 2).toUpperCase();
  }

  /**
   * Validate policy data before saving
   */
  validatePolicyData(policyData: ExtractedPolicyData): boolean {
    try {
      if (!Array.isArray(policyData.receiptStandards)) {
        this.logger.error('Invalid policy data: receiptStandards must be an array');
        return false;
      }
      if (!Array.isArray(policyData.compliancePoliciesGrossUpRelated)) {
        this.logger.error('Invalid policy data: compliancePoliciesGrossUpRelated must be an array');
        return false;
      }
      if (!Array.isArray(policyData.compliancePoliciesAdditionalInfoRelated)) {
        this.logger.error('Invalid policy data: compliancePoliciesAdditionalInfoRelated must be an array');
        return false;
      }

      const totalPolicies =
        policyData.receiptStandards.length +
        policyData.compliancePoliciesGrossUpRelated.length +
        policyData.compliancePoliciesAdditionalInfoRelated.length;

      if (totalPolicies === 0) {
        this.logger.error('Invalid policy data: No policies found');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Validation error:', error);
      return false;
    }
  }
}
