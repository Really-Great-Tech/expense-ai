import { Injectable, Logger } from '@nestjs/common';
import { PolicyValidationAgent } from '../../agents/policy-validation.agent';
import { ExtractedPolicyDataValidated, PolicyValidationResult } from '../../common/schemas/country-policy-schemas';

/**
 * Service to validate extracted policy rules against source documents
 */
@Injectable()
export class PolicyValidationService {
  private readonly logger = new Logger(PolicyValidationService.name);

  constructor(private readonly validationAgent: PolicyValidationAgent) {}

  /**
   * Validate extracted policies against a single source document
   * @param extractedPolicies - The extracted policy data to validate
   * @param sourceDocument - Original source document content
   * @param countryName - Country name for context
   * @returns Validation result with scores and judgments
   */
  async validateExtractedPolicies(
    extractedPolicies: ExtractedPolicyDataValidated,
    sourceDocument: string,
    countryName: string
  ): Promise<PolicyValidationResult> {
    this.logger.log(`Starting validation for ${countryName} policies`);

    try {
      const validationResult = await this.validationAgent.validatePolicies(
        extractedPolicies,
        sourceDocument,
        countryName
      );

      this.logger.log(
        `Validation completed for ${countryName}: ` +
        `Status=${validationResult.overall_validation_status}, ` +
        `Issues=${validationResult.critical_issues.length}`
      );

      if (validationResult.critical_issues.length > 0) {
        this.logger.warn(`Critical issues found for ${countryName}:`, validationResult.critical_issues);
      }

      return validationResult;
    } catch (error) {
      this.logger.error(`Failed to validate policies for ${countryName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate extracted policies against multiple source documents
   * @param extractedPolicies - The extracted policy data to validate
   * @param documents - Array of source documents with filenames
   * @param countryName - Country name for context
   * @returns Validation result with scores and judgments
   */
  async validateExtractedPoliciesMultiDocument(
    extractedPolicies: ExtractedPolicyDataValidated,
    documents: Array<{ fileName: string; content: string }>,
    countryName: string
  ): Promise<PolicyValidationResult> {
    this.logger.log(`Starting multi-document validation for ${countryName} (${documents.length} documents)`);

    try {
      const validationResult = await this.validationAgent.validatePoliciesMultiDocument(
        extractedPolicies,
        documents,
        countryName
      );

      this.logger.log(
        `Multi-document validation completed for ${countryName}: ` +
        `Status=${validationResult.overall_validation_status}, ` +
        `Issues=${validationResult.critical_issues.length}`
      );

      if (validationResult.critical_issues.length > 0) {
        this.logger.warn(`Critical issues found for ${countryName}:`, validationResult.critical_issues);
      }

      return validationResult;
    } catch (error) {
      this.logger.error(`Failed to validate multi-document policies for ${countryName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if validation result meets approval criteria
   * @param validationResult - The validation result to check
   * @returns True if approved, false if needs revision
   */
  isValidationApproved(validationResult: PolicyValidationResult): boolean {
    return validationResult.overall_validation_status === 'APPROVED';
  }

  /**
   * Get average validation score across all rules
   * @param validationResult - The validation result
   * @returns Average score from 0-10
   */
  getAverageValidationScore(validationResult: PolicyValidationResult): number {
    const allScores = [
      ...validationResult.receiptStandards.map(r => r.validation_score),
      ...validationResult.compliancePoliciesGrossUpRelated.map(r => r.validation_score),
      ...validationResult.compliancePoliciesAdditionalInfoRelated.map(r => r.validation_score),
    ].filter((score): score is number => score !== undefined);

    if (allScores.length === 0) {
      return 0;
    }

    const sum = allScores.reduce((acc, score) => acc + score, 0);
    return sum / allScores.length;
  }

  /**
   * Get rules with low validation scores (below threshold)
   * @param validationResult - The validation result
   * @param threshold - Score threshold (default 7)
   * @returns Array of problematic rules with their tables and scores
   */
  getProblematicRules(
    validationResult: PolicyValidationResult,
    threshold: number = 7
  ): Array<{ table: string; rule: string; score: number; judgment: string }> {
    const problematic: Array<{ table: string; rule: string; score: number; judgment: string }> = [];

    validationResult.receiptStandards.forEach(item => {
      if (item.validation_score !== undefined && item.validation_score < threshold) {
        problematic.push({
          table: 'Receipt Standards',
          rule: item.rule,
          score: item.validation_score,
          judgment: item.validation_judgment || 'No judgment provided',
        });
      }
    });

    validationResult.compliancePoliciesGrossUpRelated.forEach(item => {
      if (item.validation_score !== undefined && item.validation_score < threshold) {
        problematic.push({
          table: 'Gross Up Related',
          rule: item.gross_up_rule,
          score: item.validation_score,
          judgment: item.validation_judgment || 'No judgment provided',
        });
      }
    });

    validationResult.compliancePoliciesAdditionalInfoRelated.forEach(item => {
      if (item.validation_score !== undefined && item.validation_score < threshold) {
        problematic.push({
          table: 'Additional Info Related',
          rule: item.additional_info_rule,
          score: item.validation_score,
          judgment: item.validation_judgment || 'No judgment provided',
        });
      }
    });

    return problematic;
  }
}
