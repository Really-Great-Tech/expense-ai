import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;
  let moduleRef: TestingModule;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = moduleRef.get(LoggerService);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should output JSON formatted log messages', () => {
    service.log('test message', 'TestContext');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(output).toMatchObject({
      level: 'log',
      context: 'TestContext',
      message: 'test message',
    });
    expect(output.timestamp).toBeDefined();
  });

  it('should output JSON formatted error messages with stack', () => {
    service.error('error message', 'stack trace', 'TestContext');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(output).toMatchObject({
      level: 'error',
      context: 'TestContext',
      message: 'error message',
      stack: 'stack trace',
    });
  });

  it('should output JSON formatted warn messages', () => {
    service.warn('warning message', 'TestContext');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(output).toMatchObject({
      level: 'warn',
      context: 'TestContext',
      message: 'warning message',
    });
  });

  it('should output JSON formatted debug messages', () => {
    service.debug('debug message', 'TestContext');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(output).toMatchObject({
      level: 'debug',
      context: 'TestContext',
      message: 'debug message',
    });
  });

  it('should output JSON formatted verbose messages', () => {
    service.verbose('verbose message', 'TestContext');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(output).toMatchObject({
      level: 'verbose',
      context: 'TestContext',
      message: 'verbose message',
    });
  });

  it('should stringify non-string messages', () => {
    const objectMessage = { key: 'value', nested: { foo: 'bar' } };
    service.log(objectMessage, 'TestContext');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(output.message).toBe(JSON.stringify(objectMessage));
  });
});
