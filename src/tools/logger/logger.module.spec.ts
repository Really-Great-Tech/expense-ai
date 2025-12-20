import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from './logger.module';
import { LoggerService } from './logger.service';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

describe('LoggerModule', () => {
  it('should compile and provide LoggerService', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: false }), LoggerModule],
    }).compile();

    const logger = moduleRef.get<LoggerService>(LoggerService);
    expect(logger).toBeInstanceOf(LoggerService);

    // Verify logging methods exist
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.verbose).toBe('function');
  });

  it('should be importable by another module and injectable', async () => {
    @Module({
      imports: [LoggerModule],
    })
    class DummyConsumerModule {}

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [DummyConsumerModule],
    }).compile();

    const logger = moduleRef.get<LoggerService>(LoggerService);
    expect(logger).toBeDefined();
  });
});
