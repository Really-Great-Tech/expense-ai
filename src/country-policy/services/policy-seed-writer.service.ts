import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ExtractedPolicyData } from '../interfaces/policy-types.interface';

/**
 * ============================================================================
 * POLICY SEED WRITER SERVICE
 * ============================================================================
 * 
 * Updates the TypeScript seed file with new country policies.
 * Uses a simple regeneration approach - reads existing data, adds new country,
 * and writes back the entire file with proper TypeScript formatting.
 * 
 * Target file: src/seeds/country-policies.seed.ts
 * ============================================================================
 */

@Injectable()
export class PolicySeedWriterService {
    private readonly logger = new Logger(PolicySeedWriterService.name);
    private readonly seedFilePath: string;

    constructor() {
        // Resolve path relative to project root
        this.seedFilePath = path.resolve(process.cwd(), 'src/seeds/country-policies.seed.ts');
    }

    /**
     * Add or update a country in the seed file
     */
    async addCountryToSeedFile(
        countryName: string,
        policyData: ExtractedPolicyData,
    ): Promise<{ added: boolean; updated: boolean; filePath: string }> {

        this.logger.log('============================================');
        this.logger.log('📝 SEED FILE UPDATE STARTING');
        this.logger.log('============================================');
        this.logger.log(`🌍 Country: ${countryName}`);
        this.logger.log(`📄 File: ${this.seedFilePath}`);
        this.logger.log('');

        // Read current seeds
        const currentSeeds = await this.readCurrentSeeds();
        const wasExisting = countryName in currentSeeds;

        // Add/update country
        currentSeeds[countryName] = {
            receiptStandards: policyData.receiptStandards,
            compliancePoliciesGrossUpRelated: policyData.compliancePoliciesGrossUpRelated,
            compliancePoliciesAdditionalInfoRelated: policyData.compliancePoliciesAdditionalInfoRelated,
        };

        // Sort countries alphabetically
        const sortedSeeds: Record<string, typeof policyData> = {};
        const sortedKeys = Object.keys(currentSeeds).sort();
        for (const key of sortedKeys) {
            sortedSeeds[key] = currentSeeds[key];
        }

        // Write back
        await this.writeUpdatedSeeds(sortedSeeds);

        this.logger.log(`   ✓ ${wasExisting ? 'Updated' : 'Added'} country: ${countryName}`);
        this.logger.log(`   ✓ Total countries in seed: ${Object.keys(sortedSeeds).length}`);
        this.logger.log('============================================');
        this.logger.log('✅ SEED FILE UPDATE COMPLETE');
        this.logger.log('============================================');
        this.logger.log('');

        return {
            added: !wasExisting,
            updated: wasExisting,
            filePath: this.seedFilePath,
        };
    }

    /**
     * Read current seeds from the TypeScript file
     */
    private async readCurrentSeeds(): Promise<Record<string, ExtractedPolicyData>> {
        try {
            // Dynamic import of the seed file to get the current data
            // We use require instead of import to avoid caching issues
            const seedPath = this.seedFilePath.replace(/\\/g, '/');

            // Clear require cache to get fresh data
            delete require.cache[require.resolve(seedPath)];

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const seedModule = require(seedPath);
            return { ...seedModule.COUNTRY_POLICY_SEEDS };
        } catch (error) {
            this.logger.warn('Could not read existing seed file, starting fresh:', error);
            return {};
        }
    }

    /**
     * Write updated seeds back to the TypeScript file
     */
    private async writeUpdatedSeeds(seeds: Record<string, ExtractedPolicyData>): Promise<void> {
        const content = this.formatAsTypeScript(seeds);

        // Create backup first
        const backupPath = this.seedFilePath + '.backup';
        if (fs.existsSync(this.seedFilePath)) {
            fs.copyFileSync(this.seedFilePath, backupPath);
            this.logger.log(`   ✓ Created backup at ${backupPath}`);
        }

        // Write new content
        fs.writeFileSync(this.seedFilePath, content, 'utf-8');
        this.logger.log(`   ✓ Wrote ${content.length} bytes to seed file`);
    }

    /**
     * Format seeds as TypeScript source code
     */
    private formatAsTypeScript(seeds: Record<string, ExtractedPolicyData>): string {
        const lines: string[] = [
            '/**',
            ' * Country Policy Seed Data',
            ' *',
            ' * This file contains embedded seed data for country expense policies.',
            ' * Consolidated from individual JSON files.',
            ' *',
            ' * GENERATED FILE - Updated by Policy Extraction Pipeline',
            ' */',
            '',
            'export const COUNTRY_POLICY_SEEDS: Record<string, {',
            '  receiptStandards: Array<{',
            '    required_data: string;',
            '    travel_non_travel_both: string;',
            '    expense_type: string;',
            '    icp_name: string;',
            '    mandatory_optional: string;',
            '    rule: string;',
            '    citation?: string;',
            '  }>;',
            '  compliancePoliciesGrossUpRelated: Array<{',
            '    travel_non_travel_both: string;',
            '    expense_type: string;',
            '    icp_name: string;',
            '    gross_up: boolean;',
            '    gross_up_rule: string;',
            '    citation?: string;',
            '  }>;',
            '  compliancePoliciesAdditionalInfoRelated: Array<{',
            '    travel_non_travel_both: string;',
            '    expense_type: string;',
            '    icp_name: string;',
            '    additional_info_required: boolean;',
            '    additional_info_rule: string;',
            '    citation?: string;',
            '  }>;',
            '}> = ' + JSON.stringify(seeds, null, 2) + ';',
            '',
        ];

        return lines.join('\n');
    }
}
