import { FileClassificationResultSchema, type FileClassificationResult } from '../schemas/expense-schemas';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { MODEL_CONFIG } from './config/models.config';

/**
 * Agent responsible for classifying documents to determine if they are expenses
 * and identifying their type, language, and location
 */
export class FileClassificationAgent extends BaseAgent {
  protected llm: ILLMService;
  private currentProvider: 'bedrock' | 'anthropic';
  private modelName: string;

  constructor(provider: 'bedrock' | 'anthropic' = 'bedrock', modelName?: string) {
    super();
    this.currentProvider = provider;
    this.modelName = modelName || MODEL_CONFIG.CLASSIFICATION;
    this.logger.log(`Initializing FileClassificationAgent with provider: ${provider}`);

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
      return this.modelName;
    } else {
      // Direct Anthropic usage
      return this.modelName;
    }
  }

  /**
   * Classify a document to determine if it's an expense and identify its properties
   * @param markdownContent OCR-extracted text in markdown format
   * @param expectedCountry Expected country for location validation
   * @param expenseSchema Schema definition for expense fields
   * @returns Classification result with confidence scores and metadata
   * @throws Error if classification fails critically
   */
  async classifyFile(markdownContent: string, expectedCountry: string, expenseSchema: any): Promise<FileClassificationResult> {
    const startTime = new Date();

    try {
      this.logger.log('Starting file classification');

      // Get the prompt and compile with variables
      const combinedPrompt = await this.getPromptTemplate('file-classification-prompt', {
        schemaFieldsDescription: JSON.stringify(expenseSchema?.properties || {}, null, 2),
        markdownContent,
        expectedCountry: expectedCountry || 'Not specified',
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

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Extract and parse response using BaseAgent utilities
      const rawContent = this.extractContentFromResponse(response);
      this.logger.debug(`Extracted content: ${rawContent.substring(0, 200)}...`);

      const parsedResult = this.parseJsonResponse(rawContent);
      const result = FileClassificationResultSchema.parse(parsedResult);

      this.logger.log(
        `File classification completed: ${result.is_expense ? 'EXPENSE' : 'NOT_EXPENSE'} - ` +
          `${result.expense_type} (${result.language}) in ${duration}ms`,
      );
      this.logger.debug(`Model used: ${this.getActualModelUsed()}`);
      this.logger.debug(`Prompt metadata: ${JSON.stringify(this.getPromptMetadata())}`);

      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`File classification failed after ${duration}ms:`, error);

      // Return fallback result
      return {
        is_expense: false,
        expense_type: null,
        language: 'unknown',
        language_confidence: 0,
        document_location: 'unknown',
        expected_location: 'unknown',
        location_match: false,
        error_type: 'classification_error',
        error_message: error.message,
        classification_confidence: 0,
        reasoning: `Classification failed due to error: ${error.message}`,
        schema_field_analysis: {
          fields_found: [],
          fields_missing: [],
          total_fields_found: 0,
          expense_identification_reasoning: 'Classification failed due to system error',
        },
      };
    }
  }
}
