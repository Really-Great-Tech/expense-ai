import { IssueDetectionResultSchema, type IssueDetectionResult } from '../schemas/expense-schemas';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { MODEL_CONFIG } from './config/models.config';

/**
 * Agent responsible for detecting compliance issues in expense documents
 * Validates extracted data against country-specific compliance requirements
 */
export class IssueDetectionAgent extends BaseAgent {
  protected llm: ILLMService;
  private expenseSchema: any;
  private currentProvider: 'bedrock' | 'anthropic';
  private readonly defaultModelId: string;

  constructor(provider: 'bedrock' | 'anthropic' = 'bedrock', defaultModelId: string = MODEL_CONFIG.COMPLIANCE) {
    super();
    this.currentProvider = provider;
    this.defaultModelId = defaultModelId;
    this.logger.log(`Initializing IssueDetectionAgent with provider: ${provider}`);
    this.llm = new BedrockLlmService({ modelType: 'nova' });

    // Load expense schema
    this.loadExpenseSchema();
  }

  /**
   * Get the actual model name used, accounting for fallback scenarios
   * @returns The current model identifier
   */
  getActualModelUsed(): string {
    if (this.currentProvider === 'bedrock' && this.llm.getCurrentModelName) {
      // For BedrockLlmService, get the actual model name (handles fallback)
      return this.llm.getCurrentModelName();
    } else if (this.currentProvider === 'bedrock') {
      // Fallback for older BedrockLlmService without getCurrentModelName
      return this.defaultModelId;
    } else {
      // Direct Anthropic usage
      return 'claude-3-5-sonnet-20241022';
    }
  }

  /**
   * Load expense schema from file system
   * @private
   */
  private loadExpenseSchema(): void {
    try {
      const schemaPath = path.join(process.cwd(), 'expense_file_schema.json');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.expenseSchema = JSON.parse(schemaContent);
      this.logger.log('Expense schema loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load expense schema:', error);
      this.expenseSchema = null;
    }
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

      // Get the prompt and compile with variables
      const combinedPrompt = await this.getPromptTemplate('issue-detection-prompt', {
        expenseTaxonomyDescription: JSON.stringify(this.expenseSchema?.properties || {}, null, 2),
        country,
        receiptType,
        icp,
        complianceData: JSON.stringify(complianceData, null, 2),
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
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Compliance analysis failed after ${duration}ms:`, error);

      // Return fallback result
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
