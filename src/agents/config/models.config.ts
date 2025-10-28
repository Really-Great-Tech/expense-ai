/**
 * Centralized model configuration for all agents
 * Provides default model IDs and settings for different agent types
 */

export const MODEL_CONFIG = {
  // File classification model - needs strong reasoning
  CLASSIFICATION: 'claude-3-5-sonnet',

  // Data extraction model - balanced performance
  EXTRACTION: 'eu.amazon.nova-pro-v1:0',

  // Citation generation model - optimized for structured output
  CITATION: 'amazon.nova-micro-v1:0',

  // Image quality assessment model
  QUALITY_ASSESSMENT: 'eu.amazon.nova-pro-v1:0',

  // Compliance and issue detection model
  COMPLIANCE: 'eu.amazon.nova-pro-v1:0',

  // Document splitting model
  DOCUMENT_SPLITTER: 'eu.amazon.nova-pro-v1:0',
} as const;

/**
 * Default inference configuration
 */
export const INFERENCE_CONFIG = {
  // Maximum tokens for LLM responses
  MAX_TOKENS: 4000,

  // Default temperature for generation
  DEFAULT_TEMPERATURE: 0.7,

  // Top-p sampling parameter
  TOP_P: 0.9,

  // Citation batch size to avoid context window issues
  CITATION_BATCH_SIZE: 8,

  // Timeout for LLM requests (milliseconds)
  REQUEST_TIMEOUT: 120000, // 2 minutes
} as const;

/**
 * Provider configuration
 */
export const PROVIDER_CONFIG = {
  DEFAULT_PROVIDER: 'bedrock' as const,
  SUPPORTED_PROVIDERS: ['bedrock', 'anthropic'] as const,
} as const;

export type ModelConfigKey = keyof typeof MODEL_CONFIG;
export type SupportedProvider = (typeof PROVIDER_CONFIG.SUPPORTED_PROVIDERS)[number];
