import { COUNTRY_POLICY_SEEDS } from '../seeds/country-policies.seed';

/**
 * Extracts unique ICP names from the country policy seed data.
 * Checks all relevant policy sections and handles comma-separated values.
 */
function getAvailableIcps(): string[] {
    const icpSet = new Set<string>();

    Object.values(COUNTRY_POLICY_SEEDS).forEach(dataset => {
        // Check all sections where ICP names appear
        const sections = [
            dataset.receiptStandards,
            dataset.compliancePoliciesGrossUpRelated,
            dataset.compliancePoliciesAdditionalInfoRelated
        ];

        sections.forEach(section => {
            if (Array.isArray(section)) {
                section.forEach(item => {
                    if (item.icp_name) {
                        // Handle comma-separated values (e.g. "ICP A, ICP B")
                        const names = item.icp_name.split(',').map(s => s.trim());
                        names.forEach(name => {
                            if (name) icpSet.add(name);
                        });
                    }
                });
            }
        });
    });

    return Array.from(icpSet).sort();
}

export const AVAILABLE_COUNTRIES = Object.keys(COUNTRY_POLICY_SEEDS).sort();
export const AVAILABLE_ICPS = getAvailableIcps();
