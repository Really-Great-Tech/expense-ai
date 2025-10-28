import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { FALLBACK_PROMPTS } from './prompts/index';
import type { ILLMService, ChatMessage, ChatResponse } from './types/llm.types';

/**
 * Interface for local prompt templates
 */
interface PromptTemplate {
  /**
   * Compile the prompt with variables
   */
  compile(variables: Record<string, any>): string;

  /**
   * Raw prompt content including {{variables}}
   */
  prompt: string;

  /**
   * Optional configuration object
   */
  config?: any;

  /**
   * Prompt version
   */
  version?: number;

  /**
   * Prompt name
   */
  name?: string;
}

/**
 * Interface for storing prompt information
 */
interface PromptInfo {
  name: string;
  version?: number;
  config?: any;
}

/**
 * Options for executing LLM requests
 */
interface LLMRequestOptions {
  messages?: ChatMessage[];
  systemPrompt?: string;
}

/**
 * Base class for all agents with local prompt management capabilities
 * Provides common utilities for prompt management, LLM interaction, and response parsing
 */
export abstract class BaseAgent {
  protected readonly logger = new Logger(this.constructor.name);
  protected lastPromptInfo?: PromptInfo;
  protected llm?: ILLMService;

  constructor() {}

  /**
   * Get a prompt template from local JSON files
   * Loads prompts from src/agents/prompts/ directory
   * @param promptName Name of the prompt to load
   * @param variables Optional variables to compile into the prompt
   * @returns Compiled prompt string with variables replaced
   * @throws Error if prompt is not found
   */
  protected async getPromptTemplate(promptName: string, variables?: Record<string, any>): Promise<string> {
    try {
      // Get prompt from local fallback prompts
      const promptData = FALLBACK_PROMPTS[promptName];

      if (!promptData) {
        throw new Error(`Prompt ${promptName} not found in local prompts`);
      }

      // Debug logging for prompt retrieval
      this.logger.debug(`Retrieved prompt from local files: ${promptName}`);
      this.logger.debug(`Prompt version: ${promptData.version || 'unknown'}`);
      this.logger.debug(`Prompt config: ${JSON.stringify(promptData.config || {})}`);

      // Store prompt info for reference
      this.lastPromptInfo = {
        name: promptName,
        version: promptData.version,
        config: promptData.config,
      };

      // Create prompt template and compile with variables
      const promptTemplate = this.createPromptTemplate(promptData.prompt);
      const compiled = promptTemplate.compile(variables || {});

      return compiled;
    } catch (error) {
      this.logger.error(`Failed to get prompt ${promptName} from local files: ${error.message}`);
      throw new Error(`Prompt ${promptName} is required but not available in local prompts`);
    }
  }

  /**
   * Extract text content from LLM response
   * Handles different response formats (string, array, object)
   * @param response ChatResponse from LLM service
   * @returns Extracted text content
   */
  protected extractContentFromResponse(response: ChatResponse): string {
    const content = response.message.content;

    // Handle string content
    if (typeof content === 'string') {
      return content;
    }

    // Handle Anthropic array format: [{"type":"text","text":"..."}]
    if (Array.isArray(content) && content.length > 0) {
      const firstItem = content[0];
      if (firstItem && firstItem.type === 'text' && firstItem.text) {
        return firstItem.text;
      }
      // Fallback: stringify the array
      return JSON.stringify(content);
    }

    // Handle object content
    if (content && typeof content === 'object') {
      return JSON.stringify(content);
    }

    // Fallback: convert to string
    return String(content || '');
  }

  /**
   * Parse JSON response from LLM
   * Removes markdown code blocks and parses the content
   * @param content Raw content string from LLM
   * @returns Parsed JSON object
   * @throws Error if JSON parsing fails
   */
  protected parseJsonResponse(content: string): any {
    try {
      // Remove markdown code blocks if present
      const cleanContent = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      return JSON.parse(cleanContent);
    } catch (error) {
      this.logger.error('Failed to parse JSON response:', error);
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  /**
   * Execute a complete LLM request with prompt template and schema validation
   * This is a high-level utility that handles the entire flow:
   * 1. Load and compile prompt template
   * 2. Send request to LLM
   * 3. Extract and parse response
   * 4. Validate with Zod schema
   *
   * @template T The expected return type (inferred from schema)
   * @param promptName Name of the prompt template to use
   * @param variables Variables to compile into the prompt
   * @param schema Zod schema for validating the response
   * @param options Additional options for the LLM request
   * @returns Validated and typed response
   * @throws Error if LLM is not initialized or validation fails
   */
  protected async executeLLMRequest<T>(
    promptName: string,
    variables: Record<string, any>,
    schema: z.ZodSchema<T>,
    options?: LLMRequestOptions,
  ): Promise<T> {
    if (!this.llm) {
      throw new Error('LLM service not initialized');
    }

    // Load and compile prompt
    const prompt = await this.getPromptTemplate(promptName, variables);

    // Prepare messages
    const messages: ChatMessage[] = options?.messages || [{ role: 'user', content: prompt }];

    // Add system prompt if provided
    if (options?.systemPrompt) {
      messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    // Execute LLM request
    const response = await this.llm.chat({ messages });

    // Extract and parse response
    const content = this.extractContentFromResponse(response);
    const parsed = this.parseJsonResponse(content);

    // Validate with schema
    return schema.parse(parsed);
  }

  /**
   * Compile a prompt with variables
   * Replaces {{variable}} placeholders with actual values
   * @param prompt Prompt template string
   * @param variables Variables to replace in the prompt
   * @returns Compiled prompt string
   */
  private compilePrompt(prompt: string, variables: Record<string, any>): string {
    let compiledPrompt = prompt;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      compiledPrompt = compiledPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return compiledPrompt;
  }

  /**
   * Get prompt metadata for logging and debugging
   * @returns Prompt metadata object
   */
  protected getPromptMetadata(): Record<string, any> {
    if (!this.lastPromptInfo) {
      return {};
    }

    return {
      promptName: this.lastPromptInfo.name,
      promptVersion: this.lastPromptInfo.version || 'unknown',
      promptConfig: this.lastPromptInfo.config || {},
    };
  }

  /**
   * Generate prompt version tags for logging
   * @returns Array of version tags
   */
  protected getPromptVersionTags(): string[] {
    if (!this.lastPromptInfo) {
      return [];
    }

    const tags: string[] = [];
    const version = this.lastPromptInfo.version ? String(this.lastPromptInfo.version) : 'unknown';

    // Add prompt-specific version tag
    tags.push(`${this.lastPromptInfo.name}-v${version}`);

    // Add general version tag if version is known
    if (version !== 'unknown') {
      tags.push(`prompt-v${version}`);
    }

    return tags;
  }

  /**
   * Generate all prompt version tags from multiple prompts used in an agent
   * @param promptInfos Array of prompt information objects
   * @returns Array of all version tags
   */
  protected getAllPromptVersionTags(promptInfos: PromptInfo[]): string[] {
    const tags: string[] = [];
    const versions = new Set<string>();

    for (const promptInfo of promptInfos) {
      const version = promptInfo.version ? String(promptInfo.version) : 'unknown';

      // Add prompt-specific version tag
      tags.push(`${promptInfo.name}-v${version}`);

      // Collect unique versions
      if (version !== 'unknown') {
        versions.add(version);
      }
    }

    // Add general version tags for unique versions
    versions.forEach((version) => {
      tags.push(`prompt-v${version}`);
    });

    return tags;
  }

  /**
   * Create a prompt template object from prompt data
   * @param prompt Prompt string
   * @returns PromptTemplate object
   */
  private createPromptTemplate(prompt: string): PromptTemplate {
    return {
      compile: (variables: Record<string, any>) => {
        return this.compilePrompt(prompt, variables);
      },
      prompt,
      config: {},
    };
  }

  /**
   * Get available prompt names
   * @returns Array of available prompt names
   */
  protected getAvailablePrompts(): string[] {
    return Object.keys(FALLBACK_PROMPTS);
  }

  /**
   * Check if a prompt exists in local files
   * @param promptName Name of the prompt to check
   * @returns True if prompt exists
   */
  protected hasPrompt(promptName: string): boolean {
    return promptName in FALLBACK_PROMPTS;
  }

  /**
   * Get raw prompt data without compilation
   * @param promptName Name of the prompt
   * @returns Raw prompt data
   * @throws Error if prompt is not found
   */
  protected getRawPromptData(promptName: string): any {
    if (!this.hasPrompt(promptName)) {
      throw new Error(`Prompt ${promptName} not found in local prompts`);
    }
    return FALLBACK_PROMPTS[promptName];
  }

  /**
   * Get the actual model being used by the LLM service
   * Subclasses should override this to provide model-specific information
   * @returns Model identifier string
   */
  protected getActualModelUsed(): string {
    return this.llm?.getCurrentModelName() || 'unknown';
  }
}
