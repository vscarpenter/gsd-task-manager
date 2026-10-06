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
  | 'SYNC_METADATA'
  | 'SYNC_QUEUE'
  | 'SYNC_RETRY'
  | 'SYNC_HEALTH'
  | 'SYNC_ERROR'
  | 'SYNC_HISTORY'
  | 'SYNC_CONFIG'
  | 'SYNC_AUTH'
  | 'SYNC_REALTIME'
  | 'OAUTH'
  | 'TASK_CRUD'
  | 'TIME_TRACKING'
  | 'AUTO_ARCHIVE'
  | 'AUTH'
  | 'UI'
  | 'DB'
  | 'PWA'
  | 'NOTIFICATIONS'
  | 'NOTIFICATION_SETTINGS'
  | 'IMPORT'
  | 'SMART_VIEWS'
  | 'ERROR_BOUNDARY'
  | 'GLOBAL_ERROR'
  | 'WEBMCP'
  | 'FEEDBACK';

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

const SENSITIVE_QUERY_PARAMS_PATTERN = /token=[^&\s]+|authorization=[^&\s]+|api[_-]?key=[^&\s]+/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export function maskSensitiveString(value: string): string {
  return value
    .replace(SENSITIVE_QUERY_PARAMS_PATTERN, (match) => {
      if (match.toLowerCase().startsWith('authorization=')) {
        return 'authorization=***';
      }
      if (match.toLowerCase().startsWith('token=')) {
        return 'token=***';
      }
      return 'apikey=***';
    })
    .replace(BEARER_TOKEN_PATTERN, 'Bearer ***');
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return maskSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    return sanitizeMetadata(value as LogMetadata);
  }

  return value;
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

// Case-insensitive match on key substrings that indicate sensitive data.
const SENSITIVE_KEY_PATTERN =
  /token|password|secret|apikey|authorization|passphrase|email|credential|cookie|session|jwt|refresh|access|bearer/i;

// Task content the user wrote (SEC-011). Exact key names, so diagnostic keys
// such as `titleLength` or `tagCount` stay readable.
const TASK_CONTENT_KEY_PATTERN = /^(title|description|tags|subtasks|notes)$/i;

/**
 * Sanitize sensitive data from log metadata
 * Removes tokens, passwords, and other secrets
 */
export function sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // Sanitize URLs with tokens
  if (sanitized.url && typeof sanitized.url === 'string') {
    sanitized.url = maskSensitiveString(sanitized.url);
  }

  // Remove sensitive fields
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_KEY_PATTERN.test(key) || TASK_CONTENT_KEY_PATTERN.test(key)) {
      sanitized[key] = '***';
    } else {
      sanitized[key] = sanitizeValue(sanitized[key]);
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

  // The string argument has to carry the message on its own. A structured
  // object reads fine in devtools, which expands it — but anything that captures
  // console output stringifies the arguments, and an object-only payload lands
  // in a bug report as "[TASK_CRUD] [object Object]". The object still follows,
  // so devtools loses nothing.
  const prefix = formatLogPrefix(context, message, sanitized);

  switch (level) {
    case 'debug':
      console.debug(prefix, logObject);
      break;
    case 'info':
      console.log(prefix, logObject);
      break;
    case 'warn':
      console.warn(prefix, logObject);
      break;
    case 'error':
      console.error(prefix, logObject);
      break;
  }
}

/**
 * Build the human-readable half of a log line: context, message, and — when an
 * Error was supplied — its type and message, which are what make a report
 * actionable.
 *
 * Takes the **sanitized** metadata, never the caller's. Error text from a remote
 * 4xx body can echo task field names and values, and this string is the most
 * visible part of the log line. `tests/data/sync/pb-push.test.ts` asserts a task
 * title never reaches it.
 */
function formatLogPrefix(
  context: LogContext,
  message: string,
  sanitized?: LogMetadata
): string {
  const errorType = sanitized?.errorType;
  const errorMessage = sanitized?.errorMessage;
  const detail = errorType || errorMessage
    ? ` — ${[errorType, errorMessage].filter(Boolean).join(': ')}`
    : '';
  return `[${context}] ${message}${detail}`;
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
   * Log error message with optional Error object.
   * Logs to the console (structured, masked). Nothing leaves the device.
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (shouldLog('error', this.minLevel)) {
      const errorMetadata: LogMetadata = {
        ...metadata,
        errorType: error?.constructor.name,
        errorMessage: error?.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
      };

      formatLog('error', this.context, message, errorMetadata);
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
 * Correlation ID generator for tracking related operations.
 * Includes a random suffix to prevent collisions after page reload.
 */
let correlationCounter = 0;

export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const counter = ++correlationCounter;
  const random = Math.random().toString(36).slice(2, 6);
  return `${timestamp}-${counter}-${random}`;
}
