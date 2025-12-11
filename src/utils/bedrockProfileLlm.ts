import {
  BedrockRuntimeClient,
  ConverseCommand,
  ContentBlock,
  Message,
} from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@nestjs/common';

// ============================================================================
// Inference Profiles
// ============================================================================

export interface InferenceProfile {
  name: string;
  arn: string;
  region: string;
}

export const INFERENCE_PROFILES = {
  CLAUDE_SONNET: {
    name: 'Claude 3.5 Sonnet',
    arn: 'arn:aws:bedrock:us-west-2:330858616968:application-inference-profile/g86654lbnq2r',
    region: 'us-west-2',
  },
  NOVA_PRO: {
    name: 'Nova Pro',
    arn: 'arn:aws:bedrock:us-east-1:330858616968:application-inference-profile/26fgwxc2fn0k',
    region: 'us-east-1',
  },
  NOVA_MICRO: {
    name: 'Nova Micro',
    arn: 'arn:aws:bedrock:us-east-1:330858616968:application-inference-profile/25oj8o3d36z7',
    region: 'us-east-1',
  },
} as const;

export type ProfileKey = keyof typeof INFERENCE_PROFILES;

// ============================================================================
// Types
// ============================================================================

export interface BedrockProfileConfig {
  profile?: InferenceProfile | ProfileKey;
  accessKeyId?: string;
  secretAccessKey?: string;
  temperature?: number;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = string | (TextContent | ImageContent)[];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
}

export interface ChatResponse {
  message: {
    content: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  modelUsed?: string;
}

export interface ImageInput {
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

export interface ChatWithVisionOptions {
  prompt: string;
  images: ImageInput[];
  systemPrompt?: string;
}

// ============================================================================
// BedrockProfileLlm
// ============================================================================

/**
 * AWS Bedrock LLM Service using Application Inference Profiles
 * Drop-in replacement for BedrockLlmService with profile-based model selection
 */
export class BedrockProfileLlm {
  private readonly logger = new Logger(BedrockProfileLlm.name);
  private bedrockClient: BedrockRuntimeClient | null = null;
  private profile!: InferenceProfile;
  private temperature: number;

  private static readonly DEFAULT_PROFILE: ProfileKey = 'CLAUDE_SONNET';
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_TOKENS = 4000;

  constructor(config?: BedrockProfileConfig) {
    this.temperature = config?.temperature ?? BedrockProfileLlm.DEFAULT_TEMPERATURE;

    try {
      this.profile = this.resolveProfile(config?.profile);

      this.bedrockClient = new BedrockRuntimeClient({
        region: this.profile.region,
        credentials: this.getCredentials(config),
      });

      this.logger.log(`✅ Initialized: ${this.profile.name} (${this.profile.region})`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to initialize: ${error?.message || error}`);
      this.bedrockClient = null;
    }
  }

  private resolveProfile(profile?: InferenceProfile | ProfileKey): InferenceProfile {
    if (!profile) {
      return INFERENCE_PROFILES[BedrockProfileLlm.DEFAULT_PROFILE];
    }

    if (typeof profile === 'string') {
      const resolved = INFERENCE_PROFILES[profile];
      if (!resolved) {
        this.logger.warn(`⚠️ Profile "${profile}" not found. Using default.`);
        return INFERENCE_PROFILES[BedrockProfileLlm.DEFAULT_PROFILE];
      }
      return resolved;
    }

    if (!profile.arn || !profile.region || !profile.name) {
      this.logger.warn('⚠️ Invalid custom profile. Using default.');
      return INFERENCE_PROFILES[BedrockProfileLlm.DEFAULT_PROFILE];
    }

    return profile;
  }

  private getCredentials(config?: BedrockProfileConfig) {
    if (config?.accessKeyId && config?.secretAccessKey) {
      return {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    return undefined;
  }

  private getImageFormat(mediaType: string): 'png' | 'jpeg' | 'gif' | 'webp' {
    const format = mediaType.split('/')[1];
    return format === 'jpg' ? 'jpeg' : (format as 'png' | 'jpeg' | 'gif' | 'webp');
  }

  private formatContentBlocks(content: MessageContent): ContentBlock[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    return content.map((item) => {
      if (item.type === 'text') {
        return { text: item.text } as ContentBlock;
      }
      if (item.type === 'image') {
        return {
          image: {
            format: this.getImageFormat(item.source.media_type),
            source: { bytes: Buffer.from(item.source.data, 'base64') },
          },
        } as ContentBlock;
      }
      return { text: '' } as ContentBlock;
    });
  }

  private parseMessages(messages: ChatMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const systemMessage = systemMsg && typeof systemMsg.content === 'string' ? systemMsg.content : '';
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    return { systemMessage, conversationMessages };
  }

  async chat(options: { messages: ChatMessage[] }): Promise<ChatResponse> {
    if (!this.bedrockClient) {
      throw new Error('Bedrock client not initialized');
    }

    try {
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
          maxTokens: BedrockProfileLlm.DEFAULT_MAX_TOKENS,
          temperature: this.temperature,
        },
      });

      const response = await this.bedrockClient.send(command);

      const outputContent = response.output?.message?.content || [];
      const responseText = outputContent.map((block) => ('text' in block ? block.text : '')).join('');
      const inputTokens = response.usage?.inputTokens || 0;
      const outputTokens = response.usage?.outputTokens || 0;

      this.logger.debug(`✅ Chat: ${this.profile.name}, ${inputTokens}/${outputTokens} tokens`);

      return {
        message: { content: responseText },
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
        modelUsed: this.profile.arn,
      };
    } catch (error: any) {
      this.logger.error(`❌ Chat failed: ${error?.message || error}`);
      throw error;
    }
  }

  async chatWithVision(options: ChatWithVisionOptions): Promise<ChatResponse> {
    const content: (TextContent | ImageContent)[] = options.images.map((img) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
    }));
    content.push({ type: 'text', text: options.prompt });

    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content });

    return this.chat({ messages });
  }

  // BedrockLlmService compatible methods
  getCurrentProvider(): 'bedrock' | 'none' {
    return this.bedrockClient ? 'bedrock' : 'none';
  }

  getCurrentModelName(): string {
    return this.bedrockClient ? this.profile.arn : 'unknown';
  }

  isInitialized(): boolean {
    return this.bedrockClient !== null;
  }

  getProfileName(): string {
    return this.profile.name;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createClaudeSonnet(config?: Omit<BedrockProfileConfig, 'profile'>): BedrockProfileLlm {
  return new BedrockProfileLlm({ ...config, profile: 'CLAUDE_SONNET' });
}

export function createNovaPro(config?: Omit<BedrockProfileConfig, 'profile'>): BedrockProfileLlm {
  return new BedrockProfileLlm({ ...config, profile: 'NOVA_PRO' });
}

export function createNovaMicro(config?: Omit<BedrockProfileConfig, 'profile'>): BedrockProfileLlm {
  return new BedrockProfileLlm({ ...config, profile: 'NOVA_MICRO' });
}
