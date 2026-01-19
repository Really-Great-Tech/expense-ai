/**
 * Centralized model configuration for all agents
 * Provides profile keys and settings for different agent types
 */

import type { ProfileKey } from '../../services/bedrock/bedrock-llm';

export const AGENT_PROFILES = {
  // File classification - needs strong reasoning
  CLASSIFICATION: 'SONNET_4' as ProfileKey,

  // Data extraction - balanced performance
  EXTRACTION: 'SONNET_4' as ProfileKey,

  // Citation generation - optimized for structured output
  CITATION: 'NOVA_MICRO' as ProfileKey,

  // Image quality assessment
  QUALITY_ASSESSMENT: 'NOVA_PRO' as ProfileKey,

  // Compliance and issue detection
  COMPLIANCE: 'SONNET_4' as ProfileKey,

  // Document splitting
  DOCUMENT_SPLITTER: 'SONNET_4' as ProfileKey,
} as const;

// Judge panel profile
export const JUDGE_PROFILE: ProfileKey = 'SONNET_4';

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
  SUPPORTED_PROVIDERS: ['bedrock'] as const,
} as const;

export type SupportedProvider = (typeof PROVIDER_CONFIG.SUPPORTED_PROVIDERS)[number];
