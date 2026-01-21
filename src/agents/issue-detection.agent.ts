import { IssueDetectionResultSchema, type IssueDetectionResult } from '../common/schemas/expense-schemas';
import { EXPENSE_SCHEMA } from '../common/types';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { AGENT_PROFILES } from './config/models.config';
import { filterComplianceByIcp, getFilterStats } from './utils/compliance-filter.util';
import { ServiceUnavailableError } from '../common/errors/service-errors';

/**
 * Agent responsible for detecting compliance issues in expense documents
 * Validates extracted data against country-specific compliance requirements
 */
export class IssueDetectionAgent extends BaseAgent {
  protected llm: ILLMService;

  constructor() {
    super();
    this.logger.log('Initializing IssueDetectionAgent');
    this.llm = new BedrockLlmService({ profile: AGENT_PROFILES.COMPLIANCE });
  }

  /**
   * Get the actual model name used
   * @returns The current model identifier
   */
  getActualModelUsed(): string {
    return this.llm.getCurrentModelName();
  }

  /**
   * Analyze compliance of extracted expense data against country-specific requirements
   * @param country Country code for compliance rules
   * @param receiptType Type of receipt/invoice
   * @param icp Internal control policy identifier
   * @param complianceData Country-specific compliance requirements
   * @param extractedData Previously extracted expense data
   * @returns Issue detection result with validation status and identified issues
   * @throws Error if compliance analysis fails critically
   */
  async analyzeCompliance(country: string, receiptType: string, icp: string, complianceData: any, extractedData: any): Promise<IssueDetectionResult> {
    const startTime = new Date();

    try {
      this.logger.log(`Starting compliance analysis for ${country}/${icp}`);

      // Filter compliance data to include only rules for the specified ICP
      const filteredComplianceData = filterComplianceByIcp(complianceData, icp);

      // Log filtering statistics
      const stats = getFilterStats(complianceData, filteredComplianceData);
      this.logger.debug(`Filtered compliance rules for ICP '${icp}':`, stats);
      this.logger.debug(`Receipt Standards: ${stats.receiptStandards.original} → ${stats.receiptStandards.filtered}`);
      this.logger.debug(`Gross-Up Policies: ${stats.grossUpPolicies.original} → ${stats.grossUpPolicies.filtered}`);
      this.logger.debug(`Additional Info Policies: ${stats.additionalInfoPolicies.original} → ${stats.additionalInfoPolicies.filtered}`);

      // Get the prompt and compile with variables using filtered compliance data
      const combinedPrompt = await this.getPromptTemplate('issue-detection-prompt', {
        expenseTaxonomyDescription: JSON.stringify(EXPENSE_SCHEMA.properties, null, 2),
        country,
        receiptType,
        icp,
        complianceData: JSON.stringify(filteredComplianceData, null, 2),
        extractedData: JSON.stringify(extractedData, null, 2),
      });

      this.logger.debug(`Using prompt: ${this.lastPromptInfo?.name} (version: ${this.lastPromptInfo?.version || 'unknown'})`);

      const response = await this.llm.chat({
        messages: [
          {
            role: 'user',
            content: combinedPrompt,
          },
        ],
      });

      // Extract and parse response using BaseAgent utilities
      const rawContent = this.extractContentFromResponse(response);
      this.logger.debug(`Extracted content: ${rawContent.substring(0, 200)}...`);

      const parsedResult = this.parseJsonResponse(rawContent);
      const result = IssueDetectionResultSchema.parse(parsedResult);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.log(`Compliance analysis completed: ${result.validation_result.issues_count} issues found in ${duration}ms`);
      this.logger.debug(`Model used: ${this.getActualModelUsed()}`);
      this.logger.debug(`Prompt metadata: ${JSON.stringify(this.getPromptMetadata())}`);

      return result;
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Compliance analysis failed after ${duration}ms:`, error);

      // Re-throw ServiceUnavailableError to trigger job retry
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }

      // Wrap other retryable errors
      if (error.isRetryable || error.name === 'ServiceUnavailableError') {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }

      // Return fallback result for non-retryable errors (e.g., bad LLM response)
      return {
        validation_result: {
          is_valid: false,
          issues_count: 1,
          issues: [
            {
              issue_type: 'Standards & Compliance | Fix Identified',
              field: 'system_error',
              description: `Compliance analysis failed: ${error.message}`,
              recommendation: 'Please retry the compliance analysis or contact support.',
              knowledge_base_reference: 'System error during analysis',
              confidence_score: 0.5,
            },
          ],
          corrected_receipt: null,
          compliance_summary: 'Analysis failed due to system error',
        },
        technical_details: {
          content_type: 'expense_receipt',
          country: 'unknown',
          icp: 'unknown',
          receipt_type: 'unknown',
          issues_count: 1,
        },
      };
    }
  }
}
