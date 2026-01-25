import { MigrationInterface, QueryRunner } from 'typeorm';
import { COUNTRY_POLICY_SEEDS } from '../seeds/country-policies.seed';

/**
 * Seeds country policies from the COUNTRY_POLICY_SEEDS.
 * 
 * Note: With the new markdown-based policy architecture, this migration
 * seeds countries from the seed file. Policies with markdown content
 * should be ingested via the policy ingestion endpoint.
 */
export class SeedCountryPolicies1736504407000 implements MigrationInterface {
  name = 'SeedCountryPolicies1736504407000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const versionId = this.generateVersionId();

    for (const [countryName, policyData] of Object.entries(COUNTRY_POLICY_SEEDS)) {
      const countryCode = policyData.code || this.getCountryCode(countryName);

      // Insert country
      await queryRunner.query('INSERT INTO countries (name, code, active) VALUES (?, ?, ?)', [countryName, countryCode, 1]);

      const countryResult = await queryRunner.query('SELECT id FROM countries WHERE name = ?', [countryName]);
      const countryId = countryResult[0].id;

      // Insert version
      await queryRunner.query('INSERT INTO versions (country_id, version_id) VALUES (?, ?)', [countryId, versionId]);

      // If policy has markdown content, insert it
      if (policyData.policyMarkdown && policyData.policyMarkdown.trim()) {
        await queryRunner.query(
          'INSERT INTO country_policies (policy_markdown, page_count, icps, policy_metadata, version_country_id, version_id) VALUES (?, ?, ?, ?, ?, ?)',
          [
            policyData.policyMarkdown,
            policyData.pageCount,
            JSON.stringify(policyData.icps),
            JSON.stringify(policyData.metadata || {}),
            countryId,
            versionId,
          ],
        );

        const policyResult = await queryRunner.query(
          'SELECT id FROM country_policies WHERE version_country_id = ? AND version_id = ?',
          [countryId, versionId],
        );
        const policyId = policyResult[0].id;

        // Update country with active policy
        await queryRunner.query('UPDATE countries SET active_policy_id = ? WHERE id = ?', [policyId, countryId]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Clear active_policy_id first to avoid FK constraint issues
    await queryRunner.query('UPDATE countries SET active_policy_id = NULL');

    // Delete in reverse order of dependencies
    await queryRunner.query('DELETE FROM datasources');
    await queryRunner.query('DELETE FROM country_policies');
    await queryRunner.query('DELETE FROM versions');
    await queryRunner.query('DELETE FROM countries');
  }

  private generateVersionId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `v${year}.${month}.${day}`;
  }

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
    };
    return codes[countryName] || countryName.substring(0, 2).toUpperCase();
  }
}
