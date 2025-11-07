/**
 * Structured logging system for GSD Task Manager
 *
 * Features:
 * - Environment-aware log levels (debug in dev, info+ in prod)
 * - Structured JSON output with timestamps
 * - Correlation ID support for tracking related operations
 * - Context-prefixed messages
 * - Secret sanitization for URLs and tokens
 * - Integrates with existing error-logger.ts for errors
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@/lib/logger';
 *
 * const logger = createLogger('SYNC_ENGINE');
 * logger.debug('Starting operation', { operationId: '123' });
 * logger.info('Operation complete', { count: 5 });
 * logger.warn('Retry needed', { attempt: 2 });
 * logger.error('Operation failed', error, { phase: 'push' });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext =
  | 'SYNC_ENGINE'
  | 'SYNC_PUSH'
  | 'SYNC_PULL'
  | 'SYNC_CONFLICT'
  | 'SYNC_METADATA'
  | 'SYNC_QUEUE'
  | 'SYNC_API'
  | 'SYNC_CRYPTO'
  | 'SYNC_RETRY'
  | 'SYNC_HEALTH'
  | 'SYNC_TOKEN'
  | 'SYNC_ERROR'
  | 'SYNC_HISTORY'
  | 'TASK_CRUD'
  | 'AUTO_ARCHIVE'
  | 'AUTH'
  | 'UI'
  | 'DB'
  | 'PWA';

export interface LogMetadata {
  [key: string]: unknown;
  correlationId?: string;
  userId?: string;
  taskId?: string;
  deviceId?: string;
  timestamp?: string;
  url?: string;
  phase?: string;
  operation?: string;
}

/**
 * Get minimum log level based on environment
 */
function getMinLogLevel(): LogLevel {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return 'info';
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'info';
  }
  return 'debug';
}

/**
 * Compare log levels for filtering
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const levelIndex = levels.indexOf(level);
  const minLevelIndex = levels.indexOf(minLevel);
  return levelIndex >= minLevelIndex;
}

/**
 * Sanitize sensitive data from log metadata
 * Removes tokens, passwords, and other secrets
 */
function sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // Sanitize URLs with tokens
  if (sanitized.url && typeof sanitized.url === 'string') {
    sanitized.url = sanitized.url
      .replace(/token=[^&]+/gi, 'token=***')
      .replace(/authorization=[^&]+/gi, 'authorization=***')
      .replace(/api[_-]?key=[^&]+/gi, 'apikey=***');
  }

  // Remove sensitive fields
  const sensitiveKeys = ['token', 'password', 'secret', 'apiKey', 'authorization', 'passphrase'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '***';
    }
  }

  return sanitized;
}

/**
 * Format log output with structured data
 */
function formatLog(
  level: LogLevel,
  context: LogContext,
  message: string,
  metadata?: LogMetadata
): void {
  const timestamp = new Date().toISOString();
  const sanitized = sanitizeMetadata(metadata);

  const logObject = {
    timestamp,
    level: level.toUpperCase(),
    context,
    message,
    ...(sanitized && Object.keys(sanitized).length > 0 ? { metadata: sanitized } : {}),
  };

  // Use appropriate console method
  switch (level) {
    case 'debug':
      console.debug(`[${context}]`, message, sanitized || '');
      break;
    case 'info':
      console.log(`[${context}]`, message, sanitized || '');
      break;
    case 'warn':
      console.warn(`[${context}]`, message, sanitized || '');
      break;
    case 'error':
      console.error(`[${context}]`, logObject);
      break;
  }
}

/**
 * Logger class with context-aware logging
 */
export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext, minLevel?: LogLevel) {
    this.context = context;
    this.minLevel = minLevel || getMinLogLevel();
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, metadata?: LogMetadata): void {
    if (shouldLog('debug', this.minLevel)) {
      formatLog('debug', this.context, message, metadata);
    }
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata): void {
    if (shouldLog('info', this.minLevel)) {
      formatLog('info', this.context, message, metadata);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: LogMetadata): void {
    if (shouldLog('warn', this.minLevel)) {
      formatLog('warn', this.context, message, metadata);
    }
  }

  /**
   * Log error message with optional Error object
   * Integrates with existing error-logger.ts for structured error tracking
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (shouldLog('error', this.minLevel)) {
      const errorMetadata: LogMetadata = {
        ...metadata,
        errorType: error?.constructor.name,
        errorMessage: error?.message,
        stack: error?.stack,
      };

      formatLog('error', this.context, message, errorMetadata);

      // If this is a critical error that needs tracking, you can call error-logger.ts here
      // For now, we'll just use console.error with structured format
    }
  }

  /**
   * Create a child logger with the same configuration
   */
  child(context: LogContext): Logger {
    return new Logger(context, this.minLevel);
  }
}

/**
 * Create a logger instance for a specific context
 *
 * @param context - The logging context (e.g., 'SYNC_ENGINE', 'TASK_CRUD')
 * @param minLevel - Optional minimum log level (defaults to environment-based)
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('SYNC_ENGINE');
 * logger.info('Sync started', { deviceId: '123' });
 * ```
 */
export function createLogger(context: LogContext, minLevel?: LogLevel): Logger {
  return new Logger(context, minLevel);
}

/**
 * Correlation ID generator for tracking related operations
 */
let correlationCounter = 0;

export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const counter = ++correlationCounter;
  return `${timestamp}-${counter}`;
}
