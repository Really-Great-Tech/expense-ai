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

interface ModelTestResult {
  name: string;
  modelId: string;
  modelType: 'nova' | 'claude';
  status: 'up' | 'down';
  latency: string;
  responseText?: string;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

interface BedrockModelConfig {
  envVar: string;
  defaultValue: string;
  modelType: 'nova' | 'claude';
  description: string;
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
        region: "us-east-1",
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
   * Derive model type from model ID string at runtime
   * Works with both regular model IDs and application inference profile ARNs
   */
  private deriveModelType(modelId: string): 'nova' | 'claude' {
    const lowerModelId = modelId.toLowerCase();
    if (lowerModelId.includes('nova')) {
      return 'nova';
    }
    if (lowerModelId.includes('claude') || lowerModelId.includes('anthropic')) {
      return 'claude';
    }
    // Default to nova for unknown models (BEDROCK_MODEL defaults to Nova)
    return 'nova';
  }

  /**
   * Get all Bedrock models to test
   */
  private getModelsToTest(): BedrockModelConfig[] {
    return [
      {
        envVar: 'BEDROCK_MODEL',
        defaultValue: 'us.amazon.nova-pro-v1:0',
        modelType: 'nova',
        description: 'Primary model (extraction, quality, compliance, splitter)',
      },
      {
        envVar: 'CITATION_MODEL',
        defaultValue: 'us.amazon.nova-micro-v1:0',
        modelType: 'nova',
        description: 'Citation generation model',
      },
      {
        envVar: 'BEDROCK_JUDGE_MODEL_1',
        defaultValue: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        modelType: 'claude',
        description: 'Judge model 1 (validation)',
      },
      {
        envVar: 'BEDROCK_JUDGE_MODEL_2',
        defaultValue: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        modelType: 'claude',
        description: 'Judge model 2 (validation)',
      },
      {
        envVar: 'BEDROCK_JUDGE_MODEL_3',
        defaultValue: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        modelType: 'claude',
        description: 'Judge model 3 (validation)',
      },
    ];
  }

  /**
   * Test a single Bedrock model
   */
  private async testSingleModel(config: BedrockModelConfig): Promise<ModelTestResult> {
    const startTime = Date.now();
    const modelId = this.configService.get<string>(config.envVar, config.defaultValue);

    // Determine model type - use config type, but verify with string if using application profiles
    const usingApplicationProfile = this.configService.get<string>('USING_APPLICATION_PROFILE', 'false').toLowerCase() === 'true';
    const modelType = usingApplicationProfile ? this.deriveModelType(modelId) : config.modelType;
    const isNova = modelType === 'nova';

    try {
      let responseText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (isNova) {
        const command = new ConverseCommand({
          modelId,
          messages: [{ role: 'user', content: [{ text: 'Reply with only the word "OK"' }] }],
          inferenceConfig: { maxTokens: 10, temperature: 0, topP: 0.9 },
        });
        const response = await this.bedrockClient!.send(command);
        responseText = response.output?.message?.content?.[0]?.text || '';
        inputTokens = response.usage?.inputTokens || 0;
        outputTokens = response.usage?.outputTokens || 0;
      } else {
        const requestBody = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 10,
          temperature: 0,
          messages: [{ role: 'user', content: 'Reply with only the word "OK"' }],
        };
        const command = new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody),
        });
        const response = await this.bedrockClient!.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        responseText = responseBody.content[0].text;
        inputTokens = responseBody.usage?.input_tokens || 0;
        outputTokens = responseBody.usage?.output_tokens || 0;
      }

      const latency = Date.now() - startTime;
      return {
        name: config.envVar,
        modelId,
        modelType,
        status: 'up',
        latency: `${latency}ms`,
        responseText,
        usage: { inputTokens, outputTokens },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        name: config.envVar,
        modelId,
        modelType,
        status: 'down',
        latency: `${latency}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test Bedrock Application Inference Profiles for all configured models
   * Tests each Application Inference Profile ARN independently
   */
  async checkBedrockApplicationProfiles(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      if (!this.bedrockClient) {
        throw new Error('Bedrock client not initialized');
      }

      const modelsToTest = this.getModelsToTest();
      const profileResults: Array<{
        name: string;
        arn: string;
        status: 'up' | 'down';
        latency: string;
        error?: string;
        errorStack?: string;
        tokens?: { input: number; output: number };
      }> = [];

      // Test each Application Inference Profile
      for (const config of modelsToTest) {
        const profileArn = this.configService.get<string>(config.envVar, config.defaultValue);
        const profileStartTime = Date.now();

        try {
          this.logger.log(`Testing ${config.envVar}: ${profileArn}`);

          // Use Converse command which works with application inference profiles
          const command = new ConverseCommand({
            modelId: profileArn,
            messages: [{ role: 'user', content: [{ text: 'Respond with OK' }] }],
            inferenceConfig: { maxTokens: 10, temperature: 0 },
          });

          const response = await this.bedrockClient!.send(command);
          const profileLatency = Date.now() - profileStartTime;

          profileResults.push({
            name: config.envVar,
            arn: profileArn,
            status: 'up',
            latency: `${profileLatency}ms`,
            tokens: {
              input: response.usage?.inputTokens || 0,
              output: response.usage?.outputTokens || 0,
            },
          });

          this.logger.log(`  ✓ ${config.envVar}: up (${profileLatency}ms)`);
        } catch (error) {
          const profileLatency = Date.now() - profileStartTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          profileResults.push({
            name: config.envVar,
            arn: profileArn,
            status: 'down',
            latency: `${profileLatency}ms`,
            error: errorMessage,
            errorStack,
          });

          this.logger.warn(`  ✗ ${config.envVar}: down - ${errorMessage}`);
          if (errorStack) {
            this.logger.debug(`Stack trace: ${errorStack}`);
          }
        }
      }

      const latency = Date.now() - startTime;
      const allUp = profileResults.every((r) => r.status === 'up');
      const upCount = profileResults.filter((r) => r.status === 'up').length;
      const downCount = profileResults.filter((r) => r.status === 'down').length;

      const result: ServiceTestResult = {
        status: allUp ? 'up' : 'down',
        message: allUp
          ? `All ${profileResults.length} Application Inference Profiles operational`
          : `${downCount}/${profileResults.length} profiles down`,
        latency: `${latency}ms`,
        details: {
          region: this.configService.get('AWS_REGION', 'eu-west-1'),
          credentialsSource: this.configService.get('AWS_ACCESS_KEY_ID') ? 'explicit' : 'default-chain',
          usingApplicationProfile: true,
          summary: { total: profileResults.length, up: upCount, down: downCount },
          profiles: profileResults,
        },
      };

      if (!allUp) {
        this.logger.error(`Bedrock Application Profiles check failed: ${downCount} profiles down`);
        throw new HealthCheckError('Bedrock Application Profiles check failed', this.getStatus(key, false, result));
      }

      this.logger.log(`Bedrock Application Profiles check passed (${latency}ms, ${upCount} profiles tested)`);
      return this.getStatus(key, true, result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bedrock Application Profiles check failed: ${errorMessage}`);

      const result: ServiceTestResult = {
        status: 'down',
        message: 'Bedrock Application Profiles check failed',
        latency: `${latency}ms`,
        error: errorMessage,
        details: {
          errorType: error.constructor.name,
          region: this.configService.get('AWS_REGION', 'eu-west-1'),
        },
      };

      throw new HealthCheckError('Bedrock Application Profiles check failed', this.getStatus(key, false, result));
    }
  }

  /**
   * Test AWS Bedrock connectivity and functionality for all configured models
   * Tests: BEDROCK_MODEL, CITATION_MODEL, BEDROCK_JUDGE_MODEL_1/2/3
   */
  async checkBedrock(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      if (!this.bedrockClient) {
        throw new Error('Bedrock client not initialized');
      }

      const modelsToTest = this.getModelsToTest();
      const modelResults: ModelTestResult[] = [];

      // Test all models
      for (const config of modelsToTest) {
        this.logger.log(`Testing ${config.envVar} (${config.description})...`);
        const result = await this.testSingleModel(config);
        modelResults.push(result);
        this.logger.log(`  ${config.envVar}: ${result.status} (${result.latency})`);
      }

      const latency = Date.now() - startTime;
      const allUp = modelResults.every((r) => r.status === 'up');
      const upCount = modelResults.filter((r) => r.status === 'up').length;
      const downCount = modelResults.filter((r) => r.status === 'down').length;

      const result: ServiceTestResult = {
        status: allUp ? 'up' : 'down',
        message: allUp ? 'All Bedrock models operational' : `${downCount}/${modelResults.length} models down`,
        latency: `${latency}ms`,
        details: {
          region: this.configService.get('AWS_REGION', 'eu-west-1'),
          credentialsSource: this.configService.get('AWS_ACCESS_KEY_ID') ? 'explicit' : 'default-chain',
          usingApplicationProfile: this.configService.get<string>('USING_APPLICATION_PROFILE', 'false'),
          summary: { total: modelResults.length, up: upCount, down: downCount },
          models: modelResults,
        },
      };

      if (!allUp) {
        this.logger.error(`Bedrock health check failed: ${downCount} models down`);
        throw new HealthCheckError('Bedrock health check failed', this.getStatus(key, false, result));
      }

      this.logger.log(`Bedrock health check passed (${latency}ms, ${upCount} models tested)`);
      return this.getStatus(key, true, result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bedrock health check failed: ${errorMessage}`);

      const result: ServiceTestResult = {
        status: 'down',
        message: 'Bedrock is unavailable',
        latency: `${latency}ms`,
        error: errorMessage,
        details: {
          errorType: error.constructor.name,
          region: this.configService.get('AWS_REGION', 'eu-west-1'),
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
