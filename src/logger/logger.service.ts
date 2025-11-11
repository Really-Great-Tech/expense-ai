import { Injectable, ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

interface CoralogixConfig {
  endpoint: string;
  privateKey: string;
  applicationName: string;
  subsystemName: string;
  category?: string;
  computerName?: string;
}

interface CoralogixPayloadEntry {
  text: string;
  severity: number;
  timestamp: string;
  category?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

const CORALOGIX_SEVERITY: Record<LogLevel, number> = {
  verbose: 1,
  debug: 2,
  log: 3,
  warn: 4,
  error: 5,
};

@Injectable()
export class LoggerService extends ConsoleLogger {
  private readonly coralogixConfig?: CoralogixConfig;
  private readonly coralogixBatchSize: number;
  private readonly coralogixFlushInterval: number;
  private coralogixQueue: CoralogixPayloadEntry[] = [];
  private coralogixFlushTimer?: NodeJS.Timeout;
  private coralogixSending = false;
  private coralogixSuppressed = false;

  constructor(private readonly configService: ConfigService) {
    super();
    this.coralogixConfig = this.createCoralogixConfig();
    this.coralogixBatchSize = this.getNumericConfig('CORALOGIX_BATCH_SIZE', 25);
    this.coralogixFlushInterval = this.getNumericConfig('CORALOGIX_FLUSH_INTERVAL_MS', 1000);
  }

  override log(message: any, context?: string) {
    this.printJson('log', message, context);
    this.forwardToCoralogix('log', message, context);
  }

  override error(message: any, stack?: string, context?: string) {
    this.printJson('error', message, context, stack);
    const metadata = stack ? { stack } : undefined;
    this.forwardToCoralogix('error', message, context, metadata);
  }

  override warn(message: any, context?: string) {
    this.printJson('warn', message, context);
    this.forwardToCoralogix('warn', message, context);
  }

  override debug(message: any, context?: string) {
    this.printJson('debug', message, context);
    this.forwardToCoralogix('debug', message, context);
  }

  override verbose(message: any, context?: string) {
    this.printJson('verbose', message, context);
    this.forwardToCoralogix('verbose', message, context);
  }

  private printJson(level: LogLevel, message: any, context?: string, stack?: string): void {
    const logEntry: Record<string, any> = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    if (stack) {
      logEntry.stack = stack;
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logEntry));
  }

  private forwardToCoralogix(
    level: LogLevel,
    message: any,
    context?: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.coralogixConfig || this.coralogixSuppressed) {
      return;
    }

    let text: string;
    if (message instanceof Error) {
      text = message.stack || message.message || message.toString();
    } else if (typeof message === 'string') {
      text = message;
    } else {
      try {
        text = JSON.stringify(message);
      } catch (err) {
        text = String(message);
      }
    }

    const entry: CoralogixPayloadEntry = {
      text,
      severity: CORALOGIX_SEVERITY[level],
      timestamp: new Date().toISOString(),
      category: this.coralogixConfig.category,
      threadId: context,
    };

    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    this.enqueueCoralogixEntry(entry);
  }

  private enqueueCoralogixEntry(entry: CoralogixPayloadEntry): void {
    if (!this.coralogixConfig || this.coralogixSuppressed) {
      return;
    }

    this.coralogixQueue.push(entry);

    if (this.coralogixQueue.length >= this.coralogixBatchSize) {
      void this.flushCoralogixQueue();
      return;
    }

    if (!this.coralogixFlushTimer) {
      this.coralogixFlushTimer = setTimeout(() => {
        this.coralogixFlushTimer = undefined;
        void this.flushCoralogixQueue();
      }, this.coralogixFlushInterval);

      if (typeof this.coralogixFlushTimer.unref === 'function') {
        this.coralogixFlushTimer.unref();
      }
    }
  }

  private async flushCoralogixQueue(): Promise<void> {
    if (!this.coralogixConfig || this.coralogixSending || this.coralogixQueue.length === 0) {
      return;
    }

    if (this.coralogixFlushTimer) {
      clearTimeout(this.coralogixFlushTimer);
      this.coralogixFlushTimer = undefined;
    }

    const entries = this.coralogixQueue.splice(0, this.coralogixBatchSize);

    const payload = {
      privateKey: this.coralogixConfig.privateKey,
      applicationName: this.coralogixConfig.applicationName,
      subsystemName: this.coralogixConfig.subsystemName,
      computerName: this.coralogixConfig.computerName,
      logEntries: entries,
    };

    const fetchFn: ((input: string, init?: Record<string, unknown>) => Promise<unknown>) | undefined =
      typeof (globalThis as any).fetch === 'function'
        ? ((globalThis as any).fetch.bind(globalThis) as (input: string, init?: Record<string, unknown>) => Promise<unknown>)
        : undefined;

    if (!fetchFn) {
      this.disableCoralogix('Global fetch API unavailable');
      return;
    }

    this.coralogixSending = true;

    try {
      await fetchFn(this.coralogixConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.disableCoralogix(`Failed to send logs (${reason})`);
    } finally {
      this.coralogixSending = false;

      if (this.coralogixQueue.length > 0 && !this.coralogixSuppressed) {
        this.scheduleFlush();
      }
    }
  }

  private scheduleFlush(): void {
    if (this.coralogixFlushTimer) {
      return;
    }

    this.coralogixFlushTimer = setTimeout(() => {
      this.coralogixFlushTimer = undefined;
      void this.flushCoralogixQueue();
    }, this.coralogixFlushInterval);

    if (typeof this.coralogixFlushTimer.unref === 'function') {
      this.coralogixFlushTimer.unref();
    }
  }

  private disableCoralogix(reason: string): void {
    if (this.coralogixSuppressed) {
      return;
    }

    this.coralogixSuppressed = true;
    this.coralogixQueue = [];

    if (this.coralogixFlushTimer) {
      clearTimeout(this.coralogixFlushTimer);
      this.coralogixFlushTimer = undefined;
    }

    // eslint-disable-next-line no-console
    console.warn(`[LoggerService] Coralogix instrumentation disabled: ${reason}`);
  }

  private createCoralogixConfig(): CoralogixConfig | undefined {
    const enabled = this.configService.get<string>('CORALOGIX_ENABLED');
    if (enabled && enabled.toLowerCase() === 'false') {
      return undefined;
    }

    const privateKey = this.configService.get<string>('CORALOGIX_PRIVATE_KEY');
    if (!privateKey) {
      return undefined;
    }

    const endpoint = this.configService.get<string>('CORALOGIX_ENDPOINT', 'https://api.coralogix.com/api/v1/logs');
    const applicationName = this.configService.get<string>('CORALOGIX_APPLICATION_NAME', 'expenses-ai');
    const subsystemName = this.configService.get<string>('CORALOGIX_SUBSYSTEM_NAME', 'backend');
    const category = this.configService.get<string>('CORALOGIX_CATEGORY') || undefined;
    const computerName =
      this.configService.get<string>('CORALOGIX_COMPUTER_NAME') || process.env.HOSTNAME || process.env.COMPUTERNAME;

    return {
      endpoint,
      privateKey,
      applicationName,
      subsystemName,
      category,
      computerName,
    };
  }

  private getNumericConfig(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }
}
