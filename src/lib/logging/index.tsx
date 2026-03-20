import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { consoleTransport, logger as rnLogger } from 'react-native-logs';

import type { LogContext, LogEntry, Logger, LogLevel } from './types';

const SENSITIVE_KEYS = new Set(['token', 'password', 'passwd', 'secret', 'apikey', 'authorization', 'auth', 'cred', 'credentials', 'email', 'ssn']);

const isSensitiveKey = (key: string): boolean => SENSITIVE_KEYS.has(key.toLowerCase());

const sanitizeValue = (key: string, value: unknown, depth: number): unknown => {
  if (isSensitiveKey(key)) return '[REDACTED]';
  if (depth > 0 && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>, depth - 1);
  }
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  return value;
};

const sanitizeObject = (obj: Record<string, unknown>, depth: number): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = sanitizeValue(key, obj[key], depth);
  }
  return result;
};

export const sanitizeLogContext = (context: LogContext | undefined): LogContext => {
  if (!context) return {};
  return sanitizeObject(context as Record<string, unknown>, 2);
};

// On web, async: true wraps every log call in setTimeout which — combined with
// Sentry's setTimeout instrumentation — creates unbounded memory growth.
// Setting async: false on web prevents this. Severity stays 'debug' in dev
// on all platforms so console output is visible for debugging.
const isWeb = Platform.OS === 'web';
const isJest = typeof process !== 'undefined' && typeof process.env?.JEST_WORKER_ID !== 'undefined';

const config = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  severity: __DEV__ ? 'debug' : 'warn',
  transport: consoleTransport,
  transportOptions: {
    colors: {
      debug: 'gray',
      info: 'blueBright',
      warn: 'yellowBright',
      error: 'redBright',
    },
  },
  async: !isWeb && !isJest,
  dateFormat: 'time',
  printLevel: true,
  printDate: true,
  fixedExtLvlLength: false,
  enabled: !isJest,
};

class LogService {
  private static instance: LogService;
  private logger: any;
  private globalContext: Record<string, unknown> = {};

  private constructor() {
    this.logger = rnLogger.createLogger(config as any);
  }

  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }

  private log(level: LogLevel, { message, context = {} }: LogEntry): void {
    this.logger[level](message, {
      ...this.globalContext,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  public setGlobalContext(context: Record<string, unknown>): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  public clearGlobalContext(): void {
    this.globalContext = {};
  }

  public debug(entry: LogEntry): void {
    this.log('debug', entry);
  }

  public info(entry: LogEntry): void {
    this.log('info', entry);
  }

  public warn(entry: LogEntry): void {
    this.log('warn', entry);
  }

  public error(entry: LogEntry): void {
    this.log('error', entry);
    if (!isJest) {
      const sanitized = sanitizeLogContext(entry.context);
      const err = sanitized.error;
      if (err instanceof Error) {
        Sentry.captureException(err, { extra: { message: entry.message, ...sanitized } });
      } else {
        Sentry.captureMessage(entry.message, { level: 'error', extra: sanitized });
      }
    }
  }
}

// Export singleton instance
export const logger = LogService.getInstance();

// React hook for component usage
export const useLogger = (): Logger => {
  return {
    debug: (entry: LogEntry) => logger.debug(entry),
    info: (entry: LogEntry) => logger.info(entry),
    warn: (entry: LogEntry) => logger.warn(entry),
    error: (entry: LogEntry) => logger.error(entry),
  };
};
