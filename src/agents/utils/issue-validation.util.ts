import { Logger } from '@nestjs/common';
import { ComplianceIssue } from '../../common/schemas/expense-schemas';

/**
 * Utility for validating compliance issues against actual compliance data
 * Filters out hallucinated issues that don't reference real rules
 */

export interface ComplianceData {
  [section: string]: Array<{
    rule_id?: string;
    description: string;
    applicable_icps?: string[];
    [key: string]: any;
  }>;
}

export interface ValidationResult {
  validIssues: ComplianceIssue[];
  invalidIssues: Array<{
    issue: ComplianceIssue;
    reason: string;
  }>;
  metrics: {
    totalIssues: number;
    validCount: number;
    invalidCount: number;
    hallucinationRate: number;
  };
}

/**
 * Validates that each issue's knowledge_base_reference exists in the compliance data
 * @param issues Array of compliance issues from LLM
 * @param complianceData Country-specific compliance requirements
 * @returns Validation result with valid/invalid issues and metrics
 */
export function validateIssuesAgainstCompliance(issues: ComplianceIssue[], complianceData: ComplianceData, logger?: Logger): ValidationResult {
  if (!issues || issues.length === 0) {
    return {
      validIssues: [],
      invalidIssues: [],
      metrics: {
        totalIssues: 0,
        validCount: 0,
        invalidCount: 0,
        hallucinationRate: 0,
      },
    };
  }

  // Extract all text from compliance data
  const complianceTexts = extractComplianceText(complianceData);

  const validIssues: ComplianceIssue[] = [];
  const invalidIssues: Array<{ issue: ComplianceIssue; reason: string }> = [];

  for (const issue of issues) {
    const reference = issue.knowledge_base_reference || '';

    if (!reference || reference.trim().length === 0) {
      invalidIssues.push({
        issue,
        reason: 'Empty or missing knowledge_base_reference',
      });

      if (logger) {
        logger.debug(`Validation: INVALID - Empty reference`, {
          issue_type: issue.issue_type,
          field: issue.field,
        });
      }
      continue;
    }

    // Check if reference text exists in compliance data
    const isValid = findMatchingRule(reference, complianceTexts);

    if (isValid) {
      validIssues.push(issue);
      if (logger) {
        logger.debug(`Validation: VALID - Found match`, {
          issue_type: issue.issue_type,
          field: issue.field,
        });
      }
    } else {
      invalidIssues.push({
        issue,
        reason: 'Reference not found in compliance data',
      });

      if (logger) {
        logger.warn(`Validation: INVALID - No match found`, {
          issue_type: issue.issue_type,
          field: issue.field,
        });
      }
    }
  }

  const totalIssues = issues.length;
  const validCount = validIssues.length;
  const invalidCount = invalidIssues.length;
  const hallucinationRate = totalIssues > 0 ? invalidCount / totalIssues : 0;

  return {
    validIssues,
    invalidIssues,
    metrics: {
      totalIssues,
      validCount,
      invalidCount,
      hallucinationRate,
    },
  };
}

/**
 * Extracts all text content from compliance data structure
 * @param complianceData Compliance data object
 * @returns Array of text strings from all rules
 */
function extractComplianceText(complianceData: ComplianceData): string[] {
  const texts: string[] = [];

  if (!complianceData || typeof complianceData !== 'object') {
    return texts;
  }

  // Recursively extract text from nested structures
  function extractFromObject(obj: any) {
    if (typeof obj === 'string') {
      texts.push(obj.toLowerCase());
    } else if (Array.isArray(obj)) {
      obj.forEach(extractFromObject);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(extractFromObject);
    }
  }

  extractFromObject(complianceData);
  return texts;
}

/**
 * Checks if a reference text matches any rule in compliance data
 * Uses fuzzy matching to allow for partial quotes
 * @param reference Reference text from issue
 * @param complianceTexts Array of all text from compliance data
 * @returns True if reference matches a rule
 */
function findMatchingRule(reference: string, complianceTexts: string[]): boolean {
  const refLower = reference.toLowerCase().trim();

  // Skip very short or generic references
  if (refLower.length < 10) {
    return false;
  }

  // Generic phrases that indicate hallucination
  const genericPhrases = [
    'standard receipt requirements',
    'general compliance',
    'best practices',
    'common requirements',
    'typical policy',
    'standard procedure',
    'usual requirements',
  ];

  if (genericPhrases.some((phrase) => refLower.includes(phrase))) {
    return false;
  }

  // Check for exact or partial match
  for (const complianceText of complianceTexts) {
    // Exact substring match
    if (complianceText.includes(refLower)) {
      return true;
    }

    // Reverse match (compliance text is substring of reference)
    if (refLower.includes(complianceText) && complianceText.length > 20) {
      return true;
    }

    // Word overlap match (for paraphrased references)
    const refWords = refLower.split(/\s+/).filter((w) => w.length > 3);
    const compWords = complianceText.split(/\s+/).filter((w) => w.length > 3);

    if (refWords.length >= 3 && compWords.length >= 3) {
      const overlap = refWords.filter((word) => compWords.includes(word));
      const overlapRatio = overlap.length / Math.min(refWords.length, compWords.length);

      // If >60% of words overlap, consider it a match
      if (overlapRatio > 0.6) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get statistics about compliance data for debugging
 */
export function getComplianceStats(complianceData: ComplianceData): {
  totalSections: number;
  totalRules: number;
  sections: string[];
} {
  const sections = Object.keys(complianceData || {});
  let totalRules = 0;

  for (const section of sections) {
    const sectionData = complianceData[section];
    if (Array.isArray(sectionData)) {
      totalRules += sectionData.length;
    }
  }

  return {
    totalSections: sections.length,
    totalRules,
    sections,
  };
}
