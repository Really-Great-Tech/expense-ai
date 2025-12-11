/**
 * Type definitions for LLM service interactions
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: {
    content: string | Array<{ type: string; text?: string }> | Record<string, any>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  modelUsed?: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
}

export interface ImageInput {
  data: string; // base64 encoded image
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export interface ChatWithVisionOptions {
  prompt: string;
  images: ImageInput[];
  systemPrompt?: string;
}

/**
 * Interface for LLM service implementations (Bedrock, Anthropic, etc.)
 */
export interface ILLMService {
  /**
   * Send a chat request to the LLM
   * @param options Chat options including messages
   * @returns Promise resolving to chat response
   */
  chat(options: ChatOptions): Promise<ChatResponse>;

  /**
   * Send a chat request with vision (images + text)
   * @param options Vision chat options including prompt, images, and optional system prompt
   * @returns Promise resolving to chat response
   */
  chatWithVision?(options: ChatWithVisionOptions): Promise<ChatResponse>;

  /**
   * Get the current provider name
   * @returns Provider identifier
   */
  getCurrentProvider(): string;

  /**
   * Get the current model name/ID
   * @returns Model identifier
   */
  getCurrentModelName(): string;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  provider?: 'bedrock' | 'anthropic';
  modelId?: string;
  temperature?: number;
}
