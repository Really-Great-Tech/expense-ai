import { CitationResultSchema, type CitationResult } from '../schemas/expense-schemas';
import { BedrockLlmService } from '../utils/bedrockLlm';
import { BaseAgent } from './base.agent';
import type { ILLMService } from './types/llm.types';
import { MODEL_CONFIG, INFERENCE_CONFIG } from './config/models.config';

/**
 * Agent responsible for generating citations mapping extracted fields to source document text
 * Uses batch processing to handle large numbers of fields efficiently
 */
export class CitationGeneratorAgent extends BaseAgent {
  protected llm: ILLMService;
  private currentProvider: 'bedrock' | 'anthropic';
  private readonly citationModelId: string;

  constructor(provider: 'bedrock' | 'anthropic' = 'bedrock', citationModelId: string = MODEL_CONFIG.CITATION) {
    super();
    this.currentProvider = provider;
    this.logger.log(`Initializing CitationGeneratorAgent with provider: ${provider}`);

    // Use Nova Micro for citations - better for structured output
    this.citationModelId = citationModelId;
    this.llm = new BedrockLlmService({ modelId: this.citationModelId });
    this.logger.log(`Using model for citations: ${this.citationModelId}`);
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
      return this.citationModelId;
    } else {
      // Direct Anthropic usage
      return 'claude-3-5-sonnet';
    }
  }

  /**
   * Generate citations for all extracted fields, mapping them to source document locations
   * Processes fields in batches to avoid context window limitations
   * @param extractedData Previously extracted expense data
   * @param markdownContent Original document markdown content
   * @param filename Name of the source file
   * @returns Citation result with field-to-source mappings and metadata
   * @throws Error if citation generation fails critically
   */
  async generateCitations(extractedData: any, markdownContent: string, filename: string): Promise<CitationResult> {
    const startTime = new Date();

    try {
      this.logger.log(`Starting citation generation for ${filename}`);

      // Process citations in batches to handle context window limitations
      const fieldEntries = Object.entries(extractedData);
      const batchSize = INFERENCE_CONFIG.CITATION_BATCH_SIZE;
      const allCitations: any = {};
      let totalFieldsAnalyzed = 0;
      let fieldsWithFieldCitations = 0;
      let fieldsWithValueCitations = 0;
      let totalConfidence = 0;

      this.logger.log(`Processing ${fieldEntries.length} fields in batches of ${batchSize}`);

      for (let i = 0; i < fieldEntries.length; i += batchSize) {
        const batch = fieldEntries.slice(i, i + batchSize);
        const batchData = Object.fromEntries(batch);

        this.logger.debug(
          `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(fieldEntries.length / batchSize)} with ${batch.length} fields`,
        );

        const batchResult = await this.processCitationBatch(batchData, markdownContent, batch.length);

        // Merge batch results
        Object.assign(allCitations, batchResult.citations);
        totalFieldsAnalyzed += batchResult.metadata.total_fields_analyzed;
        fieldsWithFieldCitations += batchResult.metadata.fields_with_field_citations;
        fieldsWithValueCitations += batchResult.metadata.fields_with_value_citations;
        totalConfidence += batchResult.metadata.average_confidence * batchResult.metadata.total_fields_analyzed;
      }

      const averageConfidence = totalFieldsAnalyzed > 0 ? totalConfidence / totalFieldsAnalyzed : 0;

      const result: CitationResult = {
        citations: allCitations,
        metadata: {
          total_fields_analyzed: totalFieldsAnalyzed,
          fields_with_field_citations: fieldsWithFieldCitations,
          fields_with_value_citations: fieldsWithValueCitations,
          average_confidence: averageConfidence,
        },
      };

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.log(
        `Citation generation completed: ${result.metadata.total_fields_analyzed} fields analyzed across ${Math.ceil(fieldEntries.length / batchSize)} batches in ${duration}ms`,
      );
      this.logger.debug(`Model used: ${this.getActualModelUsed()}`);
      this.logger.debug(`Prompt metadata: ${JSON.stringify(this.getPromptMetadata())}`);

      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Citation generation failed after ${duration}ms:`, error);

      // Return fallback result
      return {
        citations: {},
        metadata: {
          total_fields_analyzed: 0,
          fields_with_field_citations: 0,
          fields_with_value_citations: 0,
          average_confidence: 0.0,
        },
      };
    }
  }

  private async processCitationBatch(batchData: any, markdownContent: string, expectedFields: number): Promise<CitationResult> {
    try {
      const combinedPrompt = await this.getPromptTemplate('citation-generation-prompt', {
        extractedDataJson: JSON.stringify(batchData, null, 2),
        markdownContent,
      });

      this.logger.debug(`Using prompt: ${this.lastPromptInfo?.name} (version: ${this.lastPromptInfo?.version || 'unknown'})`);
      this.logger.debug(`Sending batch request with ${Object.keys(batchData).length} fields`);

      const response = await this.llm.chat({
        messages: [
          {
            role: 'user',
            content: combinedPrompt,
          },
        ],
      });

      // Extract content using BaseAgent utility
      const rawContent = this.extractContentFromResponse(response);
      this.logger.debug(`Received response content length: ${rawContent.length}`);

      const parsedResult = this.parseJsonResponse(rawContent);

      // Validate the parsed result against the schema
      const validatedResult = CitationResultSchema.parse(parsedResult);

      this.logger.debug(`Successfully processed batch with ${Object.keys(validatedResult.citations).length} citations`);

      return validatedResult;
    } catch (error) {
      this.logger.error(`Failed to process citation batch: ${error.message}`);
      this.logger.error(`Batch data keys: ${Object.keys(batchData).join(', ')}`);

      // Return a fallback result for this batch
      const fallbackResult: CitationResult = {
        citations: {},
        metadata: {
          total_fields_analyzed: Object.keys(batchData).length,
          fields_with_field_citations: 0,
          fields_with_value_citations: 0,
          average_confidence: 0.0,
        },
      };

      // Try to create minimal citations for each field in the batch
      for (const fieldName of Object.keys(batchData)) {
        fallbackResult.citations[fieldName] = {
          field_citation: null,
          value_citation: null,
        };
      }

      this.logger.warn(`Returning fallback result for batch with ${Object.keys(batchData).length} fields`);
      return fallbackResult;
    }
  }

  protected parseJsonResponse(content: string): any {
    try {
      // Enhanced JSON parsing with multiple fallback strategies
      const cleanContent = this.cleanJsonContent(content);

      // Try parsing the cleaned content
      try {
        return JSON.parse(cleanContent);
      } catch (parseError) {
        this.logger.warn('Initial JSON parse failed, attempting repair...', parseError.message);

        // Attempt to repair common JSON issues
        const repairedContent = this.repairJsonContent(cleanContent);

        try {
          return JSON.parse(repairedContent);
        } catch (repairError) {
          this.logger.warn('JSON repair failed, attempting extraction...', repairError.message);

          // Last resort: extract valid JSON fragments
          const extractedJson = this.extractValidJsonFragments(content);
          return extractedJson;
        }
      }
    } catch (error) {
      this.logger.error('All JSON parsing strategies failed:', error);
      this.logger.error(`Content preview: ${content.substring(0, 1000)}...`);

      // Return a fallback structure that matches the expected schema
      return this.getFallbackCitationResult();
    }
  }

  private cleanJsonContent(content: string): string {
    // Remove markdown code blocks
    let cleanContent = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Find JSON boundaries more robustly
    const jsonStart = cleanContent.indexOf('{');
    const jsonEnd = cleanContent.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanContent = cleanContent.substring(jsonStart, jsonEnd + 1);
    }

    return cleanContent;
  }

  private repairJsonContent(content: string): string {
    let repaired = content;

    // Fix common JSON issues
    // 1. Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // 2. Fix unescaped quotes in string values (basic approach)
    repaired = repaired.replace(/"([^"]*)"(\s*:\s*)"([^"]*(?:[^"\\]|\\.)*[^"\\])"/g, (_match, key, colon, value) => {
      // Escape unescaped quotes in the value
      const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
      return `"${key}"${colon}"${escapedValue}"`;
    });

    // 3. Fix incomplete string values (add closing quotes)
    repaired = repaired.replace(/"([^"]*)"(\s*:\s*)"([^"]*?)(\s*[,}])/g, (match, key, colon, value, ending) => {
      if (!value.endsWith('"') && !ending.startsWith('"')) {
        return `"${key}"${colon}"${value}"${ending}`;
      }
      return match;
    });

    // 4. Remove any non-JSON content after the last closing brace
    const lastBrace = repaired.lastIndexOf('}');
    if (lastBrace !== -1) {
      repaired = repaired.substring(0, lastBrace + 1);
    }

    return repaired;
  }

  private extractValidJsonFragments(content: string): any {
    this.logger.warn('Attempting to extract valid JSON fragments from malformed content');

    try {
      // Try to find and extract the citations object specifically
      const citationsMatch = content.match(/"citations"\s*:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/);
      const metadataMatch = content.match(/"metadata"\s*:\s*\{[^}]*\}/);

      if (citationsMatch || metadataMatch) {
        const result: any = {
          citations: {},
          metadata: {
            total_fields_analyzed: 0,
            fields_with_field_citations: 0,
            fields_with_value_citations: 0,
            average_confidence: 0.0,
          },
        };

        if (citationsMatch) {
          try {
            const citationsJson = `{${citationsMatch[0]}}`;
            const parsed = JSON.parse(citationsJson);
            result.citations = parsed.citations || {};
          } catch (e) {
            this.logger.warn('Failed to parse extracted citations fragment');
          }
        }

        if (metadataMatch) {
          try {
            const metadataJson = `{${metadataMatch[0]}}`;
            const parsed = JSON.parse(metadataJson);
            result.metadata = { ...result.metadata, ...parsed.metadata };
          } catch (e) {
            this.logger.warn('Failed to parse extracted metadata fragment');
          }
        }

        return result;
      }
    } catch (error) {
      this.logger.warn('Fragment extraction failed:', error.message);
    }

    // If all else fails, return fallback
    return this.getFallbackCitationResult();
  }

  private getFallbackCitationResult(): any {
    this.logger.warn('Returning fallback citation result due to JSON parsing failure');

    return {
      citations: {},
      metadata: {
        total_fields_analyzed: 0,
        fields_with_field_citations: 0,
        fields_with_value_citations: 0,
        average_confidence: 0.0,
      },
    };
  }
}
