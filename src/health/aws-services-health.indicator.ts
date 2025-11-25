import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface ServiceTestResult {
  status: 'up' | 'down';
  message: string;
  latency?: string;
  details?: Record<string, any>;
  error?: string;
}

/**
 * AWS Services Health Indicator
 * Tests connectivity and operational status of AWS Textract and Bedrock services
 */
@Injectable()
export class AwsServicesHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(AwsServicesHealthIndicator.name);
  private textractClient: TextractClient | null = null;
  private bedrockClient: BedrockRuntimeClient | null = null;

  constructor(private configService: ConfigService) {
    super();
    this.initializeClients();
  }

  /**
   * Initialize AWS SDK clients
   * Uses same configuration pattern as TextractApiService and BedrockLlmService
   */
  private initializeClients(): void {
    try {
      // Textract configuration (matches TextractApiService)
      const textractRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

      const textractCredentials =
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined; // Use default credential chain if not provided

      // Initialize Textract client (same config as TextractApiService)
      this.textractClient = new TextractClient({
        region: textractRegion,
        credentials: textractCredentials,
      });

      // Bedrock configuration (matches BedrockLlmService)
      const bedrockRegion = this.configService.get<string>('AWS_REGION', 'eu-west-1');

      const bedrockCredentials =
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined; // Use default credential chain if not provided

      // Initialize Bedrock client (same config as BedrockLlmService)
      this.bedrockClient = new BedrockRuntimeClient({
        region: bedrockRegion,
        credentials: bedrockCredentials,
      });

      this.logger.log(`AWS clients initialized (Textract: ${textractRegion}, Bedrock: ${bedrockRegion})`);
    } catch (error) {
      this.logger.error(`Failed to initialize AWS clients: ${error.message}`);
    }
  }

  /**
   * Test AWS Textract connectivity and functionality
   */
  async checkTextract(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      if (!this.textractClient) {
        throw new Error('Textract client not initialized');
      }

      // Create a minimal test document (1x1 white PNG)
      // This is a valid PNG file that Textract can process
      const testImageBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const testImageBuffer = Buffer.from(testImageBase64, 'base64');

      // Attempt to call Textract DetectDocumentText
      const command = new DetectDocumentTextCommand({
        Document: {
          Bytes: testImageBuffer,
        },
      });

      const response = await this.textractClient.send(command);
      const latency = Date.now() - startTime;

      const result: ServiceTestResult = {
        status: 'up',
        message: 'Textract is operational',
        latency: `${latency}ms`,
        details: {
          region: this.configService.get('AWS_REGION', 'us-east-1'),
          credentialsSource: this.configService.get('AWS_ACCESS_KEY_ID') ? 'explicit' : 'default-chain',
          blocksDetected: response.Blocks?.length || 0,
          documentMetadata: response.DocumentMetadata,
        },
      };

      this.logger.log(`Textract health check passed (${latency}ms)`);
      return this.getStatus(key, true, result);
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Textract health check failed: ${errorMessage}`);

      const result: ServiceTestResult = {
        status: 'down',
        message: 'Textract is unavailable',
        latency: `${latency}ms`,
        error: errorMessage,
        details: {
          errorType: error.constructor.name,
          region: this.configService.get('AWS_REGION', 'us-east-1'),
        },
      };

      throw new HealthCheckError('Textract health check failed', this.getStatus(key, false, result));
    }
  }

  /**
   * Detect if the current model is Nova or Claude (matches BedrockLlmService logic)
   */
  private isNovaModel(modelId: string): boolean {
    return modelId.includes('amazon.nova');
  }

  /**
   * Test AWS Bedrock connectivity and functionality
   * Uses same model detection logic as BedrockLlmService
   */
  async checkBedrock(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      if (!this.bedrockClient) {
        throw new Error('Bedrock client not initialized');
      }

      const modelId = this.configService.get<string>('BEDROCK_MODEL', 'us.amazon.nova-pro-v1:0');
      const isNova = this.isNovaModel(modelId);

      let responseText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (isNova) {
        // Use Converse API for Nova models (same as BedrockLlmService.chatWithNova)
        const command = new ConverseCommand({
          modelId,
          messages: [
            {
              role: 'user',
              content: [{ text: 'Reply with only the word "OK"' }],
            },
          ],
          inferenceConfig: {
            maxTokens: 10,
            temperature: 0,
            topP: 0.9,
          },
        });

        const response = await this.bedrockClient.send(command);
        responseText = response.output?.message?.content?.[0]?.text || '';
        inputTokens = response.usage?.inputTokens || 0;
        outputTokens = response.usage?.outputTokens || 0;
      } else {
        // Use Invoke API for Claude models (same as BedrockLlmService.chatWithBedrock)
        const requestBody = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 10,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: 'Reply with only the word "OK"',
            },
          ],
        };

        const command = new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody),
        });

        const response = await this.bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        responseText = responseBody.content[0].text;
        inputTokens = responseBody.usage?.input_tokens || 0;
        outputTokens = responseBody.usage?.output_tokens || 0;
      }

      const latency = Date.now() - startTime;

      const result: ServiceTestResult = {
        status: 'up',
        message: 'Bedrock is operational',
        latency: `${latency}ms`,
        details: {
          region: this.configService.get('AWS_REGION', 'eu-west-1'),
          credentialsSource: this.configService.get('AWS_ACCESS_KEY_ID') ? 'explicit' : 'default-chain',
          modelId,
          modelType: isNova ? 'nova' : 'claude',
          apiUsed: isNova ? 'Converse' : 'Invoke',
          responseText,
          usage: {
            inputTokens,
            outputTokens,
          },
        },
      };

      this.logger.log(`Bedrock health check passed (${latency}ms, ${isNova ? 'Nova/Converse' : 'Claude/Invoke'})`);
      return this.getStatus(key, true, result);
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Bedrock health check failed: ${errorMessage}`);

      const modelId = this.configService.get('BEDROCK_MODEL', 'us.amazon.nova-pro-v1:0');
      const result: ServiceTestResult = {
        status: 'down',
        message: 'Bedrock is unavailable',
        latency: `${latency}ms`,
        error: errorMessage,
        details: {
          errorType: error.constructor.name,
          region: this.configService.get('AWS_REGION', 'eu-west-1'),
          modelId,
          modelType: this.isNovaModel(modelId) ? 'nova' : 'claude',
        },
      };

      throw new HealthCheckError('Bedrock health check failed', this.getStatus(key, false, result));
    }
  }

  /**
   * Test both AWS services together
   */
  async checkAllServices(key: string): Promise<HealthIndicatorResult> {
    const results: Record<string, ServiceTestResult> = {};

    // Test Textract
    try {
      const textractResult = await this.checkTextract('textract');
      results.textract = textractResult.textract as ServiceTestResult;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        results.textract = error.causes.textract as ServiceTestResult;
      } else {
        results.textract = {
          status: 'down',
          message: 'Unexpected error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Test Bedrock
    try {
      const bedrockResult = await this.checkBedrock('bedrock');
      results.bedrock = bedrockResult.bedrock as ServiceTestResult;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        results.bedrock = error.causes.bedrock as ServiceTestResult;
      } else {
        results.bedrock = {
          status: 'down',
          message: 'Unexpected error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Determine overall status
    const allUp = Object.values(results).every((r) => r.status === 'up');
    const overallMessage = allUp
      ? 'All AWS services are operational'
      : 'Some AWS services are unavailable';

    const overallResult = {
      status: allUp ? 'up' : 'down',
      message: overallMessage,
      services: results,
    };

    if (!allUp) {
      throw new HealthCheckError('AWS services health check failed', this.getStatus(key, false, overallResult));
    }

    return this.getStatus(key, true, overallResult);
  }
}
