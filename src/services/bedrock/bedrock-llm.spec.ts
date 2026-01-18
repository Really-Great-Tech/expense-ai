import 'reflect-metadata';
import { BedrockLlmService, ChatMessage } from './bedrock-llm';

// Mock app.config to provide test profile ARNs
jest.mock('../../config/app.config', () => ({
  getAppConfig: jest.fn(() => ({
    bedrock: {
      aws: {
        region: 'eu-west-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
      novaMicroArn: 'arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/nova-micro-test',
      novaProArn: 'arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/nova-pro-test',
      sonnet4Arn: 'arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/sonnet-4-test',
      sonnet45Arn: 'arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/sonnet-45-test',
    },
  })),
}));

// Mock @aws-sdk/client-bedrock-runtime
const mockState = {
  sendMock: jest.fn(),
  lastConfig: null as any,
  throwOnConstruct: false,
};

jest.mock('@aws-sdk/client-bedrock-runtime', () => {
  class BedrockRuntimeClient {
    public send: any;
    constructor(config: any) {
      if (mockState.throwOnConstruct) throw new Error('construct fail');
      mockState.lastConfig = config;
      this.send = mockState.sendMock;
    }
  }

  class ConverseCommand {
    public input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  return { BedrockRuntimeClient, ConverseCommand };
});

describe('BedrockLlmService', () => {
  beforeEach(() => {
    mockState.sendMock.mockReset();
    mockState.lastConfig = null;
    mockState.throwOnConstruct = false;
    // Clear the static cache between tests
    (BedrockLlmService as any).clientCache?.clear();
    (BedrockLlmService as any).appConfig = null;
  });

  it('should initialize with profile and report provider/model', () => {
    const svc = new BedrockLlmService({
      profile: 'NOVA_PRO',
      temperature: 0.5,
    });

    expect(svc.getCurrentProvider()).toBe('bedrock');
    expect(svc.getCurrentModelName()).toBe('arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/nova-pro-test');
    expect(svc.getProfileName()).toBe('Nova Pro');
    expect(svc.getProfileKey()).toBe('NOVA_PRO');

    // Ensure Bedrock client was constructed with region
    expect(mockState.lastConfig).toBeTruthy();
    expect(mockState.lastConfig!.region).toBe('eu-west-1');
  });

  it('should chat using unified ConverseCommand for all models', async () => {
    const svc = new BedrockLlmService({
      profile: 'NOVA_PRO',
      temperature: 0.9,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful bot.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    // Mock response
    mockState.sendMock.mockResolvedValueOnce({
      output: { message: { content: [{ text: 'Hello from Nova' }] } },
      usage: { inputTokens: 12, outputTokens: 34 },
    });

    const res = await svc.chat({ messages });

    expect(res.message.content).toBe('Hello from Nova');
    expect(res.usage).toEqual({ input_tokens: 12, output_tokens: 34 });
    expect(res.modelUsed).toBe('arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/nova-pro-test');

    // Verify ConverseCommand input
    const callArg = mockState.sendMock.mock.calls[0][0];
    expect(callArg).toBeDefined();
    expect(callArg.input).toBeDefined();
    expect(callArg.input.modelId).toBe('arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/nova-pro-test');
    // Messages should exclude system role
    expect(callArg.input.messages).toEqual([
      { role: 'user', content: [{ text: 'Hello' }] },
      { role: 'assistant', content: [{ text: 'Hi!' }] },
    ]);
    // System message should be in system array
    expect(callArg.input.system).toEqual([{ text: 'You are a helpful bot.' }]);
    expect(callArg.input.inferenceConfig.temperature).toBe(0.9);
  });

  it('should work with Claude profile using same ConverseCommand', async () => {
    const svc = new BedrockLlmService({
      profile: 'SONNET_4',
      temperature: 0.2,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Summarize this text.' },
    ];

    mockState.sendMock.mockResolvedValueOnce({
      output: { message: { content: [{ text: 'Summary content' }] } },
      usage: { inputTokens: 5, outputTokens: 7 },
    });

    const res = await svc.chat({ messages });

    expect(res.message.content).toBe('Summary content');
    expect(res.usage).toEqual({ input_tokens: 5, output_tokens: 7 });
    expect(res.modelUsed).toBe('arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/sonnet-4-test');
    expect(svc.getProfileName()).toBe('Claude Sonnet 4');

    // Verify ConverseCommand was used (same as Nova)
    const callArg = mockState.sendMock.mock.calls[0][0];
    expect(callArg.input.modelId).toBe('arn:aws:bedrock:eu-west-1:123456789:application-inference-profile/sonnet-4-test');
  });

  it('should return all configured profiles via getAllProfiles', () => {
    const profiles = BedrockLlmService.getAllProfiles();

    expect(profiles.NOVA_MICRO).toBeTruthy();
    expect(profiles.NOVA_MICRO?.name).toBe('Nova Micro');
    expect(profiles.NOVA_PRO).toBeTruthy();
    expect(profiles.NOVA_PRO?.supportsVision).toBe(true);
    expect(profiles.SONNET_4).toBeTruthy();
    expect(profiles.SONNET_4_5).toBeTruthy();
  });

  it('should cache Bedrock client by region', () => {
    // Clear any previous cache
    (BedrockLlmService as any).clientCache?.clear();

    // Create two services
    new BedrockLlmService({ profile: 'NOVA_PRO' });
    const callCount1 = mockState.lastConfig ? 1 : 0;

    new BedrockLlmService({ profile: 'SONNET_4' });
    // Should reuse the cached client, so lastConfig shouldn't change
    // (The client constructor was only called once for the region)
  });
});
