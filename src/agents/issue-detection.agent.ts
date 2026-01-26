import { IssueDetectionResultSchema, type IssueDetectionResult } from '../common/schemas/expense-schemas';
import { BedrockLlmService } from '../services/bedrock/bedrock-llm';
import { CitationVerificationService } from '../services/citation-verification.service';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { AGENT_PROFILES } from './config/models.config';
import { ServiceUnavailableError } from '../common/errors/service-errors';

/**
 * Agent responsible for detecting compliance issues in expense documents
 * Validates extracted data against country-specific policy documents in markdown format
 * with page markers for citation and verification purposes.
 */
export class IssueDetectionAgent extends BaseAgent {
  protected llm: ILLMService;
  private citationVerifier: CitationVerificationService;

  constructor() {
    super();
    this.logger.log('Initializing IssueDetectionAgent');
    this.llm = new BedrockLlmService({ profile: AGENT_PROFILES.COMPLIANCE });
    this.citationVerifier = new CitationVerificationService();
  }

  /**
   * Get the actual model name used
   * @returns The current model identifier
   */
  getActualModelUsed(): string {
    return this.llm.getCurrentModelName();
  }

  /**
   * Analyze compliance of extracted expense data against country-specific policy document
   * @param country Country code for compliance rules
   * @param receiptType Type of receipt/invoice
   * @param icp Internal control policy identifier
   * @param policyMarkdown Full policy document in markdown format with [[PAGE_X]] markers
   * @param extractedData Previously extracted expense data
   * @returns Issue detection result with validation status, identified issues, and verified citations
   * @throws Error if compliance analysis fails critically
   */
  async analyzeCompliance(
    country: string,
    receiptType: string,
    icp: string,
    policyMarkdown: string,
    extractedData: any
  ): Promise<IssueDetectionResult> {
    const startTime = new Date();

    try {
      this.logger.log(`Starting compliance analysis for ${country}/${icp}`);
      this.logger.debug(`Policy document length: ${policyMarkdown.length} characters`);

      // Get the prompt and compile with variables
      const combinedPrompt = await this.getPromptTemplate('issue-detection-prompt', {
        country,
        receiptType,
        icp,
        policyDocument: policyMarkdown,
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

      // Verify citations against the policy document
      if (result.validation_result.issues && result.validation_result.issues.length > 0) {
        this.logger.log(`Verifying citations for ${result.validation_result.issues.length} issues`);
        result.validation_result.issues = this.citationVerifier.verifyAndEnrichIssues(
          result.validation_result.issues as any,
          policyMarkdown
        ) as typeof result.validation_result.issues;
      }

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
