import { ExpenseDataSchema, type ExpenseData } from '../schemas/expense-schemas';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { MODEL_CONFIG } from './config/models.config';

/**
 * Agent responsible for extracting structured data from expense documents
 * Parses receipts/invoices and extracts vendor information, amounts, dates, line items, etc.
 */
export class DataExtractionAgent extends BaseAgent {
  protected llm: ILLMService;
  private currentProvider: 'bedrock' | 'anthropic';
  private readonly defaultModelId: string;

  constructor(provider: 'bedrock' | 'anthropic' = 'bedrock', defaultModelId: string = MODEL_CONFIG.EXTRACTION) {
    super();
    this.currentProvider = provider;
    this.defaultModelId = defaultModelId;
    this.logger.log(`Initializing DataExtractionAgent with provider: ${provider}`);

    this.llm = new BedrockLlmService();
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
      return 'claude-3-5-sonnet';
    }
  }

  /**
   * Extract structured expense data from a document
   * @param markdownContent OCR-extracted text in markdown format
   * @param _complianceRequirements Deprecated parameter, kept for API compatibility
   * @returns Extracted expense data including vendor, amounts, dates, line items, etc.
   * @throws Error if extraction fails critically
   */
  async extractData(
    markdownContent: string,
    _complianceRequirements?: any, // Kept for API compatibility - not used
  ): Promise<ExpenseData> {
    const startTime = new Date();

    try {
      this.logger.log('Starting data extraction with standard receipt/invoice schema');

      // Get the prompt and compile with variables
      const combinedPrompt = await this.getPromptTemplate('data-extraction-prompt', {
        markdownContent,
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
      const result = ExpenseDataSchema.parse(parsedResult);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.log(`Data extraction completed: ${Object.keys(result).length} fields extracted in ${duration}ms`);
      this.logger.debug(`Model used: ${this.getActualModelUsed()}`);
      this.logger.debug(`Prompt metadata: ${JSON.stringify(this.getPromptMetadata())}`);

      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Data extraction failed after ${duration}ms:`, error);

      // Return minimal fallback result
      return {
        vendor_name: 'extraction_failed',
        notes: `Error: ${error.message}`,
      };
    }
  }
}
