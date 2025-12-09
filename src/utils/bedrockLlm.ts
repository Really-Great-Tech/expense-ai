import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ModelType = 'nova' | 'claude';

export interface BedrockConfig {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  modelId?: string;
  temperature?: number;
  /**
   * Explicit model type - required when USING_APPLICATION_PROFILE=true
   * since application inference profile ARNs don't contain model name info
   */
  modelType?: ModelType;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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

/**
 * AWS Bedrock LLM Service
 * Provides a unified interface for Nova and Claude models via Bedrock
 * - Nova models use Converse API
 * - Claude models use Invoke API
 */
export class BedrockLlmService {
  private readonly logger = new Logger(BedrockLlmService.name);
  private bedrockClient: BedrockRuntimeClient | null = null;
  private modelId: string;
  private temperature: number;
  private modelType?: ModelType;
  private usingApplicationProfile: boolean;

  private static readonly configService = new ConfigService();

  constructor(config?: BedrockConfig) {
    // Initialize Bedrock client with service-specific credentials
    try {
      const fallbackRegion = BedrockLlmService.configService.get<string>('AWS_REGION', 'eu-west-1');
      const fallbackAccessKeyId = BedrockLlmService.configService.get<string>('AWS_ACCESS_KEY_ID');
      const fallbackSecretAccessKey = BedrockLlmService.configService.get<string>('AWS_SECRET_ACCESS_KEY');

      const bedrockConfig = {
        region: "us-east-1",
        credentials:
          config?.accessKeyId && config?.secretAccessKey
            ? {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
              }
            : fallbackAccessKeyId && fallbackSecretAccessKey
            ? {
                accessKeyId: fallbackAccessKeyId,
                secretAccessKey: fallbackSecretAccessKey,
              }
            : undefined,
      };

      this.bedrockClient = new BedrockRuntimeClient(bedrockConfig);

      // Check if using application inference profiles globally
      this.usingApplicationProfile = BedrockLlmService.configService.get<string>('USING_APPLICATION_PROFILE', 'false').toLowerCase() === 'true';

      // Prefer env var over config, use config as fallback, then hardcoded default
      this.modelId = BedrockLlmService.configService.get<string>('BEDROCK_MODEL') || config?.modelId || 'us.amazon.nova-pro-v1:0';

      // Store model type from config (agents pass this based on their known model type)
      this.modelType = config?.modelType;

      // Validate: if using application profile, model type must be provided by caller
      if (this.usingApplicationProfile && !this.modelType) {
        throw new Error('modelType is required when USING_APPLICATION_PROFILE=true');
      }

      this.temperature = config?.temperature ?? 0.7; // Default temperature
      this.logger.log(
        `✅ Bedrock client initialized: model=${this.modelId}, ` +
          `type=${this.modelType || 'auto-detect'}, ` +
          `appProfile=${this.usingApplicationProfile}, temp=${this.temperature}`,
      );
    } catch (error) {
      this.logger.warn(`⚠️ Failed to initialize Bedrock client: ${error.message}`);
      this.bedrockClient = null;
    }
  }

  /**
   * Detect if the current model is Nova or Claude
   * When USING_APPLICATION_PROFILE=true, uses explicit modelType from config
   * Otherwise, infers from model ID string
   */
  private isNovaModel(): boolean {
    if (this.usingApplicationProfile) {
      return this.modelType === 'nova';
    }
    return this.modelId.includes('amazon.nova');
  }

  /**
   * Chat with Nova/Claude model via Bedrock
   */
  async chat(options: { messages: ChatMessage[] }): Promise<ChatResponse> {
    if (!this.bedrockClient) {
      throw new Error('Bedrock client not initialized');
    }

    if (this.isNovaModel()) {
      return await this.chatWithNova(options.messages);
    } else {
      return await this.chatWithBedrock(options.messages);
    }
  }

  /**
   * Chat using AWS Bedrock Nova models via Converse API
   */
  private async chatWithNova(messages: ChatMessage[]): Promise<ChatResponse> {
    // Convert messages to Nova format
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const command = new ConverseCommand({
      modelId: this.modelId,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant', // Nova only supports user/assistant in messages
        content: [{ text: msg.content }],
      })),
      system: systemMessage ? [{ text: systemMessage }] : undefined,
      inferenceConfig: {
        maxTokens: 4000,
        topP: 0.9,
        temperature: this.temperature,
      },
    });

    const response = await this.bedrockClient!.send(command);

    this.logger.log(`✅ Nova chat completed successfully using model: ${this.modelId}`);

    // Return same format as other providers for consistency
    return {
      message: {
        content: response.output?.message?.content?.[0]?.text || '',
      },
      usage: {
        input_tokens: response.usage?.inputTokens || 0,
        output_tokens: response.usage?.outputTokens || 0,
      },
      modelUsed: this.modelId,
    };
  }

  /**
   * Chat using AWS Bedrock Claude models via Invoke API
   */
  private async chatWithBedrock(messages: ChatMessage[]): Promise<ChatResponse> {
    // Convert messages to Claude format
    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4000,
      temperature: this.temperature,
      system: systemMessage,
      messages: conversationMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await this.bedrockClient!.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    this.logger.log(`✅ Bedrock chat completed successfully using model: ${this.modelId}`);

    // Return same format as Anthropic client for consistency
    return {
      message: {
        content: responseBody.content[0].text,
      },
      usage: {
        input_tokens: responseBody.usage?.input_tokens || 0,
        output_tokens: responseBody.usage?.output_tokens || 0,
      },
      modelUsed: this.modelId,
    };
  }


  /**
   * Get the current provider being used
   */
  getCurrentProvider(): 'bedrock' | 'none' {
    if (this.bedrockClient) return 'bedrock';
    return 'none';
  }

  /**
   * Get the model name currently configured
   */
  getCurrentModelName(): string {
    if (this.bedrockClient) {
      return this.modelId;
    }
    return 'unknown';
  }
}
