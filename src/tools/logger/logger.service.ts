import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class LoggerService implements NestLoggerService {
  log(message: any, context?: string) {
    this.printJson('log', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    this.printJson('error', message, context, stack);
  }

  warn(message: any, context?: string) {
    this.printJson('warn', message, context);
  }

  debug(message: any, context?: string) {
    this.printJson('debug', message, context);
  }

  verbose(message: any, context?: string) {
    this.printJson('verbose', message, context);
  }

  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      if (value instanceof Error) {
        return { message: value.message, name: value.name, stack: value.stack };
      }
      return value;
    });
  }

  private printJson(level: 'log' | 'error' | 'warn' | 'debug' | 'verbose', message: any, context?: string, stack?: string): void {
    const logEntry: Record<string, any> = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : this.safeStringify(message),
    };

    if (stack) {
      logEntry.stack = stack;
    }

    // eslint-disable-next-line no-console
    console.log(this.safeStringify(logEntry));
  }
}
