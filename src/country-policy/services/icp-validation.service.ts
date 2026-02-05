import { Injectable, Logger } from '@nestjs/common';
import { CountryPolicyService } from './country-policy.service';

@Injectable()
export class IcpValidationService {
  private readonly logger = new Logger(IcpValidationService.name);

  // In-memory cache: country → Set of valid ICPs
  private icpCache = new Map<string, Set<string>>();

  constructor(private readonly countryPolicyService: CountryPolicyService) { }

  /**
   * Check if an ICP is valid for a given country
   * Uses in-memory cache after first DB lookup
   */
  async isValidIcp(country: string, icp: string): Promise<boolean> {
    if (!icp?.trim() || !country?.trim()) {
      return false;
    }

    const normalizedCountry = country.trim().toLowerCase();
    const normalizedIcp = icp.trim().toLowerCase();

    // Load and cache if not already cached
    if (!this.icpCache.has(normalizedCountry)) {
      const icps = await this.loadIcpsFromDatabase(normalizedCountry);
      this.icpCache.set(normalizedCountry, icps);
    }

    return this.icpCache.get(normalizedCountry)?.has(normalizedIcp) ?? false;
  }

  /**
   * Get all valid ICPs for a country
   */
  async getValidIcpsForCountry(country: string): Promise<Set<string>> {
    const normalizedCountry = country.trim().toLowerCase();

    if (!this.icpCache.has(normalizedCountry)) {
      const icps = await this.loadIcpsFromDatabase(normalizedCountry);
      this.icpCache.set(normalizedCountry, icps);
    }

    return this.icpCache.get(normalizedCountry);
  }

  /**
   * Load ICPs from database only - no fallback
   * Throws if no compliance data found
   */
  private async loadIcpsFromDatabase(country: string): Promise<Set<string>> {
    const icps = new Set<string>();

    const countryRecord = await this.countryPolicyService.findCountryByName(country);

    if (!countryRecord) {
      throw new Error(`Country '${country}' not found in database`);
    }

    if (!countryRecord.activePolicy?.rules) {
      throw new Error(`No active compliance policy found for country: ${country}`);
    }

    this.extractIcpsFromRules(countryRecord.activePolicy.rules, icps);

    if (icps.size === 0) {
      throw new Error(`No ICPs found in compliance data for country: ${country}`);
    }

    this.logger.log(`Loaded ${icps.size} ICPs for ${country}`);
    return icps;
  }

  /**
   * Extract all unique ICPs from compliance rules
   */
  private extractIcpsFromRules(rules: any, icps: Set<string>): void {
    const sections = [
      'receiptStandards',
      'compliancePoliciesGrossUpRelated',
      'compliancePoliciesAdditionalInfoRelated',
    ];

    for (const section of sections) {
      const ruleList = rules[section];
      if (Array.isArray(ruleList)) {
        for (const rule of ruleList) {
          const icpField = rule.icp_id || rule.icpId;
          if (icpField) {
            const icpList = icpField.split(',').map((s: string) => s.trim().toLowerCase());
            icpList.forEach((icpId: string) => {
              if (icpId) {
                icps.add(icpId);
              }
            });
          }
        }
      }
    }
  }

  /**
   * Clear cache (useful for testing or after policy updates)
   */
  clearCache(): void {
    this.icpCache.clear();
  }
}
