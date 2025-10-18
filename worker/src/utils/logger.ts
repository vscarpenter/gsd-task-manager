/**
 * Structured logging utility for worker
 * Provides consistent, searchable log format across all handlers
 */

interface LogContext {
  userId?: string;
  deviceId?: string;
  taskId?: string;
  provider?: string;
  operation?: string;
  [key: string]: any;
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Format log message with structured context
 */
function formatLog(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? JSON.stringify(context) : '';
  return `[${timestamp}] [${level}] [${module}] ${message} ${contextStr}`;
}

/**
 * Log info message
 */
export function logInfo(module: string, message: string, context?: LogContext): void {
  console.log(formatLog('INFO', module, message, context));
}

/**
 * Log warning message
 */
export function logWarn(module: string, message: string, context?: LogContext): void {
  console.warn(formatLog('WARN', module, message, context));
}

/**
 * Log error message
 */
export function logError(module: string, message: string, error?: Error, context?: LogContext): void {
  const errorContext = {
    ...context,
    error: error?.message,
    stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
  };
  console.error(formatLog('ERROR', module, message, errorContext));
}

/**
 * Log debug message (only in development)
 */
export function logDebug(module: string, message: string, context?: LogContext, env?: string): void {
  if (env === 'development') {
    console.debug(formatLog('DEBUG', module, message, context));
  }
}

/**
 * Create a scoped logger for a specific module
 */
export function createLogger(module: string) {
  return {
    info: (message: string, context?: LogContext) => logInfo(module, message, context),
    warn: (message: string, context?: LogContext) => logWarn(module, message, context),
    error: (message: string, error?: Error, context?: LogContext) => logError(module, message, error, context),
    debug: (message: string, context?: LogContext, env?: string) => logDebug(module, message, context, env),
  };
}
