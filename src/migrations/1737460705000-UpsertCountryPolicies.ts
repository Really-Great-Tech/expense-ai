import { MigrationInterface, QueryRunner } from 'typeorm';
import { COUNTRY_POLICY_SEEDS } from '../seeds/country-policies.seed';

export class UpsertCountryPolicies1737460705000 implements MigrationInterface {
  name = 'UpsertCountryPolicies1737460705000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const versionId = 'v2025.01.21.1200';
    await queryRunner.startTransaction();

    try {
      for (const [countryName, policyData] of Object.entries(COUNTRY_POLICY_SEEDS)) {
        const countryCode = this.getCountryCode(countryName);

        // Check if country exists
        let countryId: number;
        const existingCountry = await queryRunner.manager
          .createQueryBuilder()
          .select('id')
          .from('countries', 'c')
          .where('c.name = :name', { name: countryName })
          .getRawOne();

        if (!existingCountry) {
          // Insert new country
          const insertResult = await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into('countries')
            .values({ name: countryName, code: countryCode, active: true })
            .execute();
          countryId = insertResult.identifiers[0].id;
        } else {
          countryId = existingCountry.id;
        }

        // Insert new version
        await queryRunner.manager.createQueryBuilder().insert().into('versions').values({ countryId, versionId }).execute();

        // Transform policy data to rules format
        const rules = {
          receiptStandards: policyData.receiptStandards || [],
          compliancePoliciesGrossUpRelated: policyData.compliancePoliciesGrossUpRelated || [],
          compliancePoliciesAdditionalInfoRelated: policyData.compliancePoliciesAdditionalInfoRelated || [],
        };

        // Insert country policy
        const policyInsertResult = await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into('country_policies')
          .values({
            rules: JSON.stringify(rules),
            versionCountryId: countryId,
            versionId: versionId,
          })
          .execute();

        const policyId = policyInsertResult.identifiers[0].id;

        // Update country with latest active policy
        await queryRunner.manager
          .createQueryBuilder()
          .update('countries')
          .set({ activePolicyId: policyId })
          .where('id = :id', { id: countryId })
          .execute();
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('Cannot roll back UpsertCountryPolicies migration - manual intervention required');
  }

  private getCountryCode(countryName: string): string {
    const codes: Record<string, string> = {
      Austria: 'AT',
      Belgium: 'BE',
      Brazil: 'BR',
      Chile: 'CL',
      China: 'CN',
      Colombia: 'CO',
      Cyprus: 'CY',
      'Czech Republic': 'CZ',
      Denmark: 'DK',
      Egypt: 'EG',
      France: 'FR',
      Germany: 'DE',
      India: 'IN',
      Indonesia: 'ID',
      Italy: 'IT',
      Japan: 'JP',
      Lithuania: 'LT',
      Luxembourg: 'LU',
      Malaysia: 'MY',
      Netherlands: 'NL',
      Philippines: 'PH',
      Poland: 'PL',
      Singapore: 'SG',
      'South Africa': 'ZA',
      'South Korea': 'KR',
      Spain: 'ES',
      Switzerland: 'CH',
      Taiwan: 'TW',
      Thailand: 'TH',
      'United Arab Emirates (UAE)': 'AE',
      'United Kingdom': 'GB',
      Vietnam: 'VN',
    };
    return codes[countryName] || countryName.substring(0, 2).toUpperCase();
  }
}
