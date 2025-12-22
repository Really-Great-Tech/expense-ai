import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { AppConfigType } from '../config/app.config';
import { BedrockLlmService, ProfileKey, InferenceProfile } from '../services/bedrock/bedrock-llm';

interface ServiceTestResult {
  status: 'up' | 'down';
  message: string;
  latency?: string;
  details?: Record<string, any>;
  error?: string;
}

interface ProfileTestResult {
  profileKey: string;
  profileName: string;
  arn: string;
  status: 'up' | 'down';
  latency: string;
  responseText?: string;
  usage?: { inputTokens: number; outputTokens: number };
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
  private readonly appConfig: AppConfigType;

  constructor(private configService: ConfigService) {
    super();
    this.appConfig = this.configService.get<AppConfigType>('app')!;
    this.initializeClients();
  }

  /**
   * Initialize AWS SDK clients
   * Uses AWS SDK default credential chain for authentication:
   * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
   * 2. Shared credentials file (~/.aws/credentials)
   * 3. ECS Container credentials (Task Role)
   * 4. EC2 Instance metadata (Instance Profile)
   */
  private initializeClients(): void {
    try {
      const awsRegion = this.appConfig.aws.region;

      // Initialize Textract client - uses default credential chain
      this.textractClient = new TextractClient({
        region: awsRegion,
      });

      // Initialize Bedrock client - uses default credential chain
      this.bedrockClient = new BedrockRuntimeClient({
        region: awsRegion,
      });

      this.logger.log(`AWS clients initialized (Textract: ${awsRegion}, Bedrock: ${awsRegion})`);
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
          region: this.appConfig.aws.region,
          credentialsSource: 'default-chain',
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
          region: this.appConfig.aws.region,
        },
      };

      throw new HealthCheckError('Textract health check failed', this.getStatus(key, false, result));
    }
  }

  /**
   * Get all configured Bedrock profiles to test
   * Uses BedrockLlmService.getAllProfiles() to get profiles with configured ARNs
   */
  private getProfilesToTest(): Array<{ key: ProfileKey; profile: InferenceProfile }> {
    const allProfiles = BedrockLlmService.getAllProfiles();
    const configured: Array<{ key: ProfileKey; profile: InferenceProfile }> = [];

    for (const [key, profile] of Object.entries(allProfiles)) {
      if (profile !== null) {
        configured.push({ key: key as ProfileKey, profile });
      }
    }

    return configured;
  }

  /**
   * Test a single Bedrock profile using unified ConverseCommand
   * Works for both Nova and Claude models via Application Inference Profiles
   */
  private async testSingleProfile(profileKey: ProfileKey, profile: InferenceProfile): Promise<ProfileTestResult> {
    const startTime = Date.now();

    try {
      // Unified ConverseCommand works for all models (Nova and Claude)
      const command = new ConverseCommand({
        modelId: profile.arn,
        messages: [{ role: 'user', content: [{ text: 'Reply with only the word "OK"' }] }],
        inferenceConfig: { maxTokens: 10, temperature: 0, topP: 0.9 },
      });

      const response = await this.bedrockClient!.send(command);
      const responseText = response.output?.message?.content?.[0]?.text || '';
      const inputTokens = response.usage?.inputTokens || 0;
      const outputTokens = response.usage?.outputTokens || 0;

      const latency = Date.now() - startTime;
      return {
        profileKey,
        profileName: profile.name,
        arn: profile.arn,
        status: 'up',
        latency: `${latency}ms`,
        responseText,
        usage: { inputTokens, outputTokens },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        profileKey,
        profileName: profile.name,
        arn: profile.arn,
        status: 'down',
        latency: `${latency}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test AWS Bedrock connectivity and functionality for all configured profiles
   * Tests all profiles that have ARNs configured (NOVA_MICRO, NOVA_PRO, SONNET_4, SONNET_4_5)
   */
  async checkBedrock(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      if (!this.bedrockClient) {
        throw new Error('Bedrock client not initialized');
      }

      const profilesToTest = this.getProfilesToTest();

      if (profilesToTest.length === 0) {
        throw new Error('No Bedrock profiles configured. Set BEDROCK_*_ARN environment variables.');
      }

      const profileResults: ProfileTestResult[] = [];

      // Test all configured profiles
      for (const { key: profileKey, profile } of profilesToTest) {
        this.logger.log(`Testing ${profileKey} (${profile.name})...`);
        const result = await this.testSingleProfile(profileKey, profile);
        profileResults.push(result);
        this.logger.log(`  ${profileKey}: ${result.status} (${result.latency})`);
      }

      const latency = Date.now() - startTime;
      const allUp = profileResults.every((r) => r.status === 'up');
      const upCount = profileResults.filter((r) => r.status === 'up').length;
      const downCount = profileResults.filter((r) => r.status === 'down').length;

      const result: ServiceTestResult = {
        status: allUp ? 'up' : 'down',
        message: allUp ? 'All Bedrock profiles operational' : `${downCount}/${profileResults.length} profiles down`,
        latency: `${latency}ms`,
        details: {
          region: this.appConfig.aws.region,
          credentialsSource: 'default-chain',
          summary: { total: profileResults.length, up: upCount, down: downCount },
          profiles: profileResults,
        },
      };

      if (!allUp) {
        this.logger.error(`Bedrock health check failed: ${downCount} profiles down`);
        throw new HealthCheckError('Bedrock health check failed', this.getStatus(key, false, result));
      }

      this.logger.log(`Bedrock health check passed (${latency}ms, ${upCount} profiles tested)`);
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
          region: this.appConfig.aws.region,
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
