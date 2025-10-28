import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';
import { ConfigService } from '@nestjs/config';

describe('LoggerService', () => {
  let service: LoggerService;
  let moduleRef: TestingModule;

  const buildModule = async (configMap: Record<string, string | undefined>) => {
    const mockConfigService: jest.Mocked<ConfigService> = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const value = configMap[key];
        return value !== undefined ? value : defaultValue;
      }),
    } as any;

    return Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
  };

  afterEach(() => {
    jest.restoreAllMocks();
    (global as any).fetch = undefined;
  });

  it('should not initialize Coralogix when private key is missing', async () => {
    moduleRef = await buildModule({
      CORALOGIX_ENABLED: 'true',
      // No CORALOGIX_PRIVATE_KEY provided
    });

    service = moduleRef.get(LoggerService);

    // Call a few logging methods - should not enqueue anything or attempt to send
    service.log('test-log', 'TestContext');
    service.warn('test-warn', 'TestContext');
    service.error('test-error', 'stacktrace', 'TestContext');

    // Access internal state to verify no queueing happened
    const queue = (service as any).coralogixQueue as any[];
    const cfg = (service as any).coralogixConfig;

    expect(cfg).toBeUndefined();
    expect(queue.length).toBe(0);
  });

  it('should enqueue and flush to Coralogix when configured', async () => {
    // Provide full Coralogix config and force batch size 1 for immediate flush
    moduleRef = await buildModule({
      CORALOGIX_PRIVATE_KEY: 'test-private-key',
      CORALOGIX_ENDPOINT: 'https://example.com/logs',
      CORALOGIX_APPLICATION_NAME: 'app',
      CORALOGIX_SUBSYSTEM_NAME: 'sub',
      CORALOGIX_CATEGORY: 'cat',
      CORALOGIX_COMPUTER_NAME: 'host',
      CORALOGIX_BATCH_SIZE: '1',
      CORALOGIX_FLUSH_INTERVAL_MS: '5',
    });

    // Mock global fetch
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;

    service = moduleRef.get(LoggerService);

    service.debug('hello world', 'UnitTest');

    // Allow async flush to occur
    await new Promise((res) => setImmediate(res));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0];

    expect(endpoint).toBe('https://example.com/logs');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = JSON.parse((init as any).body);
    expect(body).toHaveProperty('privateKey', 'test-private-key');
    expect(body).toHaveProperty('applicationName', 'app');
    expect(body).toHaveProperty('subsystemName', 'sub');
    expect(Array.isArray(body.logEntries)).toBe(true);
    expect(body.logEntries.length).toBe(1);
    expect(body.logEntries[0]).toMatchObject({
      text: 'hello world',
      severity: 2, // debug -> 2
      threadId: 'UnitTest',
      category: 'cat',
    });
  });

  it('should fallback numeric configs when invalid values provided', async () => {
    moduleRef = await buildModule({
      CORALOGIX_PRIVATE_KEY: 'test-private-key',
      CORALOGIX_BATCH_SIZE: 'invalid', // not a number, should fallback to default 25
      CORALOGIX_FLUSH_INTERVAL_MS: '-10', // invalid (& non-positive), should fallback to default 1000
    });

    service = moduleRef.get(LoggerService);

    const batchSize = (service as any).coralogixBatchSize;
    const flushInterval = (service as any).coralogixFlushInterval;

    expect(batchSize).toBe(25);
    expect(flushInterval).toBe(1000);
  });

  it('should disable Coralogix if fetch is unavailable', async () => {
    moduleRef = await buildModule({
      CORALOGIX_PRIVATE_KEY: 'test-private-key',
      CORALOGIX_BATCH_SIZE: '1',
    });

    // Ensure no global fetch
    (global as any).fetch = undefined;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    service = moduleRef.get(LoggerService);

    // Enqueue a log which attempts to flush
    service.log('no-fetch', 'Ctx');

    // Let async tasks proceed
    await new Promise((res) => setImmediate(res));

    // Coralogix should be disabled and queue cleared without throwing
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[LoggerService] Coralogix instrumentation disabled: Global fetch API unavailable'));
    const queue = (service as any).coralogixQueue as any[];
    expect(queue.length).toBe(0);
  });
});
