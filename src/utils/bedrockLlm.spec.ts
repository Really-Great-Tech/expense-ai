import 'reflect-metadata';
import { BedrockLlmService, ChatMessage } from './bedrockLlm';

// Mock @nestjs/config first to control ConfigService behavior
jest.mock('@nestjs/config', () => {
  return {
    ConfigService: jest.fn().mockImplementation(() => ({
      get: jest.fn((key: string, defaultValue?: any) => {
        const values: Record<string, string> = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'AKIA_ENV_TEST',
          AWS_SECRET_ACCESS_KEY: 'SECRET_ENV_TEST',
          USING_APPLICATION_PROFILE: 'false',
        };
        return values[key] ?? defaultValue;
      }),
    })),
  };
});

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
      // attach a mock send
      this.send = mockState.sendMock;
    }
  }

  class InvokeModelCommand {
    public input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  class ConverseCommand {
    public input: any;
    constructor(input: any) {
      this.input = input;
    }
  }

  return { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand };
});

describe('BedrockLlmService', () => {
  beforeEach(() => {
    mockState.sendMock.mockReset();
    mockState.lastConfig = null;
    mockState.throwOnConstruct = false;
  });

  it('should initialize with provided config and report provider/model', () => {
    const svc = new BedrockLlmService({
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'SECRET_TEST',
      region: 'us-east-1',
      modelId: 'eu.amazon.nova-pro-v1:0',
      temperature: 0.5,
    });

    // Provider should be bedrock when client is set
    expect(svc.getCurrentProvider()).toBe('bedrock');
    expect(svc.getCurrentModelName()).toBe('eu.amazon.nova-pro-v1:0');

    // Ensure Bedrock client was constructed with passed region and credentials
    expect(mockState.lastConfig).toBeTruthy();
    expect(mockState.lastConfig!.region).toBe('us-east-1');
    expect(mockState.lastConfig!.credentials).toEqual({
      accessKeyId: 'AKIA_TEST',
      secretAccessKey: 'SECRET_TEST',
    });
  });

  it('should chat using Nova (Converse) API when modelId contains amazon.nova', async () => {
    const svc = new BedrockLlmService({
      modelId: 'eu.amazon.nova-pro-v1:0',
      temperature: 0.9,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful bot.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    // Mock Nova response
    mockState.sendMock.mockResolvedValueOnce({
      output: { message: { content: [{ text: 'Hello from Nova' }] } },
      usage: { inputTokens: 12, outputTokens: 34 },
    });

    const res = await svc.chat({ messages });

    expect(res.message.content).toBe('Hello from Nova');
    expect(res.usage).toEqual({ input_tokens: 12, output_tokens: 34 });
    expect(res.modelUsed).toBe('eu.amazon.nova-pro-v1:0');

    // Ensure ConverseCommand input mapping is correct via mock send call argument
    // send was called with an instance whose 'input' holds the converse payload
    const callArg = mockState.sendMock.mock.calls[0][0];
    expect(callArg).toBeDefined();
    // The constructor stored input under 'input' (see mock)
    expect(callArg.input).toBeDefined();
    expect(callArg.input.modelId).toBe('eu.amazon.nova-pro-v1:0');
    // Nova supports only user/assistant roles in messages
    expect(callArg.input.messages).toEqual([
      { role: 'user', content: [{ text: 'Hello' }] },
      { role: 'assistant', content: [{ text: 'Hi!' }] },
    ]);
    // System message must be placed under system array
    expect(callArg.input.system).toEqual([{ text: 'You are a helpful bot.' }]);
    // Temperature propagated
    expect(callArg.input.inferenceConfig.temperature).toBe(0.9);
  });

  it('should chat using Claude (Invoke) API when modelId is not Nova', async () => {
    const svc = new BedrockLlmService({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      temperature: 0.2,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Summarize this text.' },
    ];

    // Build a response body that BedrockLlmService expects and encode as Uint8Array
    const responseBody = {
      content: [{ text: 'Summary content' }],
      usage: { input_tokens: 5, output_tokens: 7 },
    };
    const encoded = new TextEncoder().encode(JSON.stringify(responseBody));

    mockState.sendMock.mockResolvedValueOnce({
      body: encoded,
    });

    const res = await svc.chat({ messages });

    expect(res.message.content).toBe('Summary content');
    expect(res.usage).toEqual({ input_tokens: 5, output_tokens: 7 });
    expect(res.modelUsed).toBe('anthropic.claude-3-sonnet-20240229-v1:0');

    // Verify InvokeModelCommand input
    const callArg = mockState.sendMock.mock.calls[0][0];
    expect(callArg).toBeDefined();
    expect(callArg.input).toBeDefined();
    expect(callArg.input.modelId).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
    expect(callArg.input.contentType).toBe('application/json');
    expect(callArg.input.accept).toBe('application/json');

    const parsedBody = JSON.parse(callArg.input.body);
    expect(parsedBody.temperature).toBe(0.2);
    expect(parsedBody.system).toBe('Be concise.');
    expect(parsedBody.messages).toEqual([
      { role: 'user', content: 'Summarize this text.' },
    ]);
  });

  it('should throw if bedrock client failed to initialize', async () => {
    mockState.throwOnConstruct = true;
    const svc = new BedrockLlmService({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    });

    await expect(svc.chat({ messages: [{ role: 'user', content: 'Hi' }] })).rejects.toThrow(
      'Bedrock client not initialized'
    );
    // Provider should be none
    expect(svc.getCurrentProvider()).toBe('none');
    expect(svc.getCurrentModelName()).toBe('unknown');
  });
});
