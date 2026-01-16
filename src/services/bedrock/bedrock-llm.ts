import { BedrockRuntimeClient, ConverseCommand, ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@nestjs/common';
import { BrokenCircuitError, BulkheadRejectedError } from 'cockatiel';
import { getAppConfig, AppConfigType } from '../../config/app.config';
import { getGlobalCircuitBreakerService, getGlobalBulkheadService } from '../../resilience';
import { ServiceUnavailableError, RetryableBulkheadTimeoutError } from '../../common/errors/service-errors';

// ============================================================================
// Types
// ============================================================================

export type ProfileKey = 'NOVA_MICRO' | 'NOVA_PRO' | 'SONNET_4' | 'SONNET_4_5';

export interface InferenceProfile {
  name: string;
  arn: string;
  supportsVision: boolean;
}

export interface BedrockConfig {
  profile: ProfileKey;
  temperature?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export type MessageContent = TextContent | ImageContent;

export interface ChatResponse {
  message: { content: string };
  usage?: { input_tokens: number; output_tokens: number };
  modelUsed?: string;
}

export interface ChatWithVisionOptions {
  prompt: string;
  images: Array<{ data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }>;
  systemPrompt?: string;
}

// ============================================================================
// BedrockLlmService
// ============================================================================

interface ProfileDefinition {
  name: string;
  supportsVision: boolean;
  arnKey: keyof AppConfigType['bedrock'];
}

export class BedrockLlmService {
  private static readonly logger = new Logger(BedrockLlmService.name);
  private static clientCache = new Map<string, BedrockRuntimeClient>();
  private static appConfig: AppConfigType | null = null;

  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_TOKENS = 4000;

  // Profile definitions - ARNs come from centralized config
  private static readonly PROFILES: Record<ProfileKey, ProfileDefinition> = {
    NOVA_MICRO: { name: 'Nova Micro', supportsVision: false, arnKey: 'novaMicroArn' },
    NOVA_PRO: { name: 'Nova Pro', supportsVision: true, arnKey: 'novaProArn' },
    SONNET_4: { name: 'Claude Sonnet 4', supportsVision: true, arnKey: 'sonnet4Arn' },
    SONNET_4_5: { name: 'Claude Sonnet 4.5', supportsVision: true, arnKey: 'sonnet45Arn' },
  };

  private readonly profile: InferenceProfile;
  private readonly profileKey: ProfileKey;
  private readonly temperature: number;
  private readonly client: BedrockRuntimeClient;

  private static getConfig(): AppConfigType {
    if (!this.appConfig) {
      this.appConfig = getAppConfig();
    }
    return this.appConfig;
  }

  private static getProfile(key: ProfileKey): InferenceProfile {
    const config = this.getConfig();
    const profileDef = this.PROFILES[key];
    const arn = config.bedrock[profileDef.arnKey];

    if (!arn) {
      throw new Error(`Missing config: bedrock.${profileDef.arnKey} (set BEDROCK_${key}_ARN env var)`);
    }

    return {
      name: profileDef.name,
      arn,
      supportsVision: profileDef.supportsVision,
    };
  }

  private static getClient(): BedrockRuntimeClient {
    const config = this.getConfig();
    const region = config.aws.region;

    if (!this.clientCache.has(region)) {
      this.clientCache.set(
        region,
        new BedrockRuntimeClient({
          region,
          maxAttempts: 4,
          retryMode: 'adaptive',
        }),
      );
      this.logger.log(`Created Bedrock client for region: ${region}`);
    }

    return this.clientCache.get(region)!;
  }

  constructor(config: BedrockConfig) {
    this.profileKey = config.profile;
    this.profile = BedrockLlmService.getProfile(config.profile);
    this.temperature = config.temperature ?? BedrockLlmService.DEFAULT_TEMPERATURE;
    this.client = BedrockLlmService.getClient();

    BedrockLlmService.logger.log(`Initialized: ${this.profile.name}, temp=${this.temperature}`);
  }

  // Unified chat - ConverseCommand works for all models
  // Wrapped with bulkhead (concurrency limiter with timeout waiting) and circuit breaker
  async chat(options: { messages: ChatMessage[] }): Promise<ChatResponse> {
    const bulkheadService = getGlobalBulkheadService();
    const circuitBreaker = getGlobalCircuitBreakerService().getBedrockBreaker();

    try {
      // Bulkhead with timeout: waits up to 15s for a slot instead of immediate rejection
      // Circuit breaker: fail-fast if service is down
      return await bulkheadService.executeWithTimeout('bedrock', async () => {
        return await circuitBreaker.execute(async () => {
          const { systemMessage, conversationMessages } = this.parseMessages(options.messages);

          const messages: Message[] = conversationMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: this.formatContentBlocks(msg.content),
          }));

          const command = new ConverseCommand({
            modelId: this.profile.arn,
            messages,
            system: systemMessage ? [{ text: systemMessage }] : undefined,
            inferenceConfig: {
              maxTokens: BedrockLlmService.DEFAULT_MAX_TOKENS,
              temperature: this.temperature,
            },
          });

          const response = await this.client.send(command);
          const content = response.output?.message?.content || [];
          const text = content.map((block) => ('text' in block ? block.text : '')).join('');

          return {
            message: { content: text },
            usage: {
              input_tokens: response.usage?.inputTokens || 0,
              output_tokens: response.usage?.outputTokens || 0,
            },
            modelUsed: this.profile.arn,
          };
        });
      });
    } catch (error: any) {
      // ValidationException/AccessDeniedException are PERMANENT config errors
      if (error.name === 'ValidationException' || error.name === 'AccessDeniedException') {
        BedrockLlmService.logger.error(
          `Bedrock config error (permanent, not retryable): ${error.name} - ${error.message}. ` +
          'Check: 1) Model enabled in AWS console, 2) IAM permissions, 3) Region availability',
        );
        throw error;
      }
      // Bulkhead timeout - waited but no slot available, job should retry
      if (error instanceof RetryableBulkheadTimeoutError) {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }
      // Bulkhead rejected (shouldn't happen with executeWithTimeout, but keep for safety)
      if (error instanceof BulkheadRejectedError) {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }
      // Circuit breaker open - service is down
      if (error instanceof BrokenCircuitError) {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }
      // AWS throttling - retryable
      if (error.name === 'ThrottlingException' || error.$metadata?.httpStatusCode === 429) {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }
      // AWS service unavailable - retryable
      if (error.$metadata?.httpStatusCode === 503) {
        throw new ServiceUnavailableError('Bedrock', error, true);
      }
      throw error;
    }
  }

  // Vision support
  async chatWithVision(options: ChatWithVisionOptions): Promise<ChatResponse> {
    if (!this.profile.supportsVision) {
      BedrockLlmService.logger.warn(`${this.profile.name} doesn't support vision, using text-only`);
      return this.chat({
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: options.prompt },
        ],
      });
    }

    const content: MessageContent[] = [
      ...options.images.map((img) => ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
      })),
      { type: 'text' as const, text: options.prompt },
    ];

    return this.chat({
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content },
      ],
    });
  }

  // Helpers
  private parseMessages(messages: ChatMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const systemMessage = systemMsg && typeof systemMsg.content === 'string' ? systemMsg.content : '';
    return { systemMessage, conversationMessages: messages.filter((m) => m.role !== 'system') };
  }

  private formatContentBlocks(content: string | MessageContent[]): ContentBlock[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    return content.map((item) => {
      if (item.type === 'text') return { text: item.text } as ContentBlock;
      if (item.type === 'image') {
        const format = item.source.media_type.split('/')[1];
        return {
          image: {
            format: format === 'jpg' ? 'jpeg' : format,
            source: { bytes: Buffer.from(item.source.data, 'base64') },
          },
        } as ContentBlock;
      }
      return { text: '' } as ContentBlock;
    });
  }

  // Accessors
  getCurrentProvider(): 'bedrock' {
    return 'bedrock';
  }

  getCurrentModelName(): string {
    return this.profile.arn;
  }

  getProfileName(): string {
    return this.profile.name;
  }

  getProfileKey(): ProfileKey {
    return this.profileKey;
  }

  // For health checks - get all configured profiles
  static getAllProfiles(): Record<ProfileKey, InferenceProfile | null> {
    const config = this.getConfig();
    const result: Record<string, InferenceProfile | null> = {};

    for (const [key, def] of Object.entries(this.PROFILES)) {
      const arn = config.bedrock[def.arnKey];
      result[key] = arn ? { name: def.name, arn, supportsVision: def.supportsVision } : null;
    }

    return result as Record<ProfileKey, InferenceProfile | null>;
  }
}
