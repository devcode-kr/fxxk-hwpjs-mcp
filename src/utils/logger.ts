export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

let currentLogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

function formatMessage(level: string, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.error(formatMessage('DEBUG', message, context));
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.error(formatMessage('INFO', message, context));
    }
  },

  warn(message: string, context?: Record<string, unknown>): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.error(formatMessage('WARN', message, context));
    }
  },

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      const errorContext = error
        ? { ...context, error: error.message, stack: error.stack }
        : context;
      console.error(formatMessage('ERROR', message, errorContext));
    }
  },
};
