/**
 * Utility functions for filtering compliance data by ICP
 */

interface ComplianceRule {
  icp_name?: string;
  icpName?: string;
  [key: string]: any;
}

interface ComplianceData {
  receiptStandards?: ComplianceRule[];
  compliancePoliciesGrossUpRelated?: ComplianceRule[];
  compliancePoliciesAdditionalInfoRelated?: ComplianceRule[];
  [key: string]: any;
}

/**
 * Checks if a given ICP is included in a comma-separated list of ICP names
 * Handles both 'icp_name' and 'icpName' field variations
 *
 * @param rule - The compliance rule object
 * @param targetIcp - The ICP to search for
 * @returns true if the ICP is found in the rule's ICP list
 */
function ruleMatchesIcp(rule: ComplianceRule, targetIcp: string): boolean {
  // Get the ICP name field (support both snake_case and camelCase)
  const icpNameField = rule.icp_name || rule.icpName;

  if (!icpNameField) {
    return false;
  }

  // Normalize the target ICP for case-insensitive comparison
  const normalizedTargetIcp = targetIcp.trim().toLowerCase();

  // Return false if target ICP is empty
  if (!normalizedTargetIcp) {
    return false;
  }

  // Split by comma and check if any ICP matches
  const icpList = icpNameField.split(',').map((icp) => icp.trim().toLowerCase());

  return icpList.includes(normalizedTargetIcp);
}

/**
 * Filters compliance data to include only rules applicable to the specified ICP
 *
 * @param complianceData - The full compliance data object
 * @param icp - The ICP identifier to filter by
 * @returns Filtered compliance data containing only rules for the specified ICP
 *
 * @example
 * const filtered = filterComplianceByIcp(complianceData, 'Atlas');
 * // Returns only rules where icp_name includes 'Atlas'
 */
export function filterComplianceByIcp(complianceData: ComplianceData, icp: string): ComplianceData {
  if (!complianceData) {
    return complianceData;
  }

  // If ICP is not provided or empty, return empty filtered data
  if (!icp || !icp.trim()) {
    return {
      receiptStandards: [],
      compliancePoliciesGrossUpRelated: [],
      compliancePoliciesAdditionalInfoRelated: [],
    };
  }

  const filtered: ComplianceData = {};

  // Filter receiptStandards
  if (Array.isArray(complianceData.receiptStandards)) {
    filtered.receiptStandards = complianceData.receiptStandards.filter((rule) => ruleMatchesIcp(rule, icp));
  }

  // Filter compliancePoliciesGrossUpRelated
  if (Array.isArray(complianceData.compliancePoliciesGrossUpRelated)) {
    filtered.compliancePoliciesGrossUpRelated = complianceData.compliancePoliciesGrossUpRelated.filter((rule) => ruleMatchesIcp(rule, icp));
  }

  // Filter compliancePoliciesAdditionalInfoRelated
  if (Array.isArray(complianceData.compliancePoliciesAdditionalInfoRelated)) {
    filtered.compliancePoliciesAdditionalInfoRelated = complianceData.compliancePoliciesAdditionalInfoRelated.filter((rule) =>
      ruleMatchesIcp(rule, icp),
    );
  }

  // Copy any other fields that might exist
  Object.keys(complianceData).forEach((key) => {
    if (key !== 'receiptStandards' && key !== 'compliancePoliciesGrossUpRelated' && key !== 'compliancePoliciesAdditionalInfoRelated') {
      filtered[key] = complianceData[key];
    }
  });

  return filtered;
}

/**
 * Gets statistics about filtered compliance data
 * Useful for logging and debugging
 *
 * @param original - Original compliance data
 * @param filtered - Filtered compliance data
 * @returns Object with counts of rules before and after filtering
 */
export function getFilterStats(original: ComplianceData, filtered: ComplianceData) {
  return {
    receiptStandards: {
      original: original.receiptStandards?.length || 0,
      filtered: filtered.receiptStandards?.length || 0,
    },
    grossUpPolicies: {
      original: original.compliancePoliciesGrossUpRelated?.length || 0,
      filtered: filtered.compliancePoliciesGrossUpRelated?.length || 0,
    },
    additionalInfoPolicies: {
      original: original.compliancePoliciesAdditionalInfoRelated?.length || 0,
      filtered: filtered.compliancePoliciesAdditionalInfoRelated?.length || 0,
    },
  };
}
