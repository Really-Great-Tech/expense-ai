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
   * Load ICPs from database - using the new markdown-based policy structure
   * ICPs are now stored directly in the policy record's icps array
   */
  private async loadIcpsFromDatabase(country: string): Promise<Set<string>> {
    const icps = new Set<string>();

    const countryRecord = await this.countryPolicyService.findCountryByName(country);

    if (!countryRecord) {
      throw new Error(`Country '${country}' not found in database`);
    }

    if (!countryRecord.activePolicy) {
      throw new Error(`No active compliance policy found for country: ${country}`);
    }

    // With the new structure, ICPs are stored directly in the policy's icps array
    if (countryRecord.activePolicy.icps && Array.isArray(countryRecord.activePolicy.icps)) {
      for (const icpName of countryRecord.activePolicy.icps) {
        if (icpName && typeof icpName === 'string') {
          icps.add(icpName.trim().toLowerCase());
        }
      }
    }

    if (icps.size === 0) {
      // Add a default ICP if none found
      icps.add('general');
      this.logger.warn(`No specific ICPs found for ${country}, using default 'general'`);
    }

    this.logger.log(`Loaded ${icps.size} ICPs for ${country}: ${[...icps].join(', ')}`);
    return icps;
  }

  /**
   * Clear cache (useful for testing or after policy updates)
   */
  clearCache(): void {
    this.icpCache.clear();
  }
}
