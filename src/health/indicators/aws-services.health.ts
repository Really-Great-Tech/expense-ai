import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { AppConfigType } from '../../config/app.config';
import { BedrockLlmService, ProfileKey } from '../../services/bedrock/bedrock-llm';

// Minimal 1x1 white PNG for Textract test
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

@Injectable()
export class AwsServicesHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(AwsServicesHealthIndicator.name);
  private readonly textractClient: TextractClient;
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly region: string;

  constructor(configService: ConfigService) {
    super();
    const appConfig = configService.get<AppConfigType>('app')!;
    this.region = appConfig.aws.region;
    this.textractClient = new TextractClient({ region: this.region });
    this.bedrockClient = new BedrockRuntimeClient({ region: this.region });
  }

  async checkTextract(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      const response = await this.textractClient.send(
        new DetectDocumentTextCommand({
          Document: { Bytes: Buffer.from(TEST_IMAGE_BASE64, 'base64') },
        }),
      );

      const latency = Date.now() - startTime;
      this.logger.log(`Textract health check passed (${latency}ms)`);

      return this.getStatus(key, true, {
        status: 'up',
        latency: `${latency}ms`,
        blocksDetected: response.Blocks?.length || 0,
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Textract health check failed: ${message}`);

      throw new HealthCheckError('Textract check failed', this.getStatus(key, false, { status: 'down', latency: `${latency}ms`, error: message }));
    }
  }

  async checkBedrock(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      const profiles = BedrockLlmService.getAllProfiles();
      const configured = Object.entries(profiles).filter(([, p]) => p !== null) as [ProfileKey, NonNullable<(typeof profiles)[ProfileKey]>][];

      if (configured.length === 0) {
        throw new Error('No Bedrock profiles configured');
      }

      const results = await Promise.all(
        configured.map(async ([profileKey, profile]) => {
          const profileStart = Date.now();
          try {
            const response = await this.bedrockClient.send(
              new ConverseCommand({
                modelId: profile.arn,
                messages: [{ role: 'user', content: [{ text: 'OK' }] }],
                inferenceConfig: { maxTokens: 5, temperature: 0 },
              }),
            );
            return {
              profile: profileKey,
              status: 'up' as const,
              latency: `${Date.now() - profileStart}ms`,
              tokens: response.usage?.inputTokens || 0,
            };
          } catch (error) {
            return {
              profile: profileKey,
              status: 'down' as const,
              latency: `${Date.now() - profileStart}ms`,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }),
      );

      const latency = Date.now() - startTime;
      const failed = results.filter((r) => r.status === 'down');

      if (failed.length > 0) {
        this.logger.error(`Bedrock health check failed: ${failed.length}/${results.length} profiles down`);
        throw new HealthCheckError(
          'Bedrock check failed',
          this.getStatus(key, false, { status: 'down', latency: `${latency}ms`, profiles: results }),
        );
      }

      this.logger.log(`Bedrock health check passed (${latency}ms, ${results.length} profiles)`);
      return this.getStatus(key, true, { status: 'up', latency: `${latency}ms`, profiles: results });
    } catch (error) {
      if (error instanceof HealthCheckError) throw error;

      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bedrock health check failed: ${message}`);

      throw new HealthCheckError('Bedrock check failed', this.getStatus(key, false, { status: 'down', latency: `${latency}ms`, error: message }));
    }
  }
}
