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

import { captureException, captureMessage } from '@/lib/sentry';

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
  | 'WEBMCP';

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

function maskSensitiveString(value: string): string {
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

/**
 * Sanitize sensitive data from log metadata
 * Removes tokens, passwords, and other secrets
 */
function sanitizeMetadata(metadata?: LogMetadata): LogMetadata | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // Sanitize URLs with tokens
  if (sanitized.url && typeof sanitized.url === 'string') {
    sanitized.url = maskSensitiveString(sanitized.url);
  }

  // Remove sensitive fields (case-insensitive match on key substrings)
  const sensitivePatterns = [
    'token', 'password', 'secret', 'apikey', 'authorization',
    'passphrase', 'email', 'credential', 'cookie', 'session',
    'jwt', 'refresh', 'access', 'bearer',
  ];
  for (const key of Object.keys(sanitized)) {
    const lower = key.toLowerCase();
    if (sensitivePatterns.some(pattern => lower.includes(pattern))) {
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

  // Use structured logObject for all levels for consistent output
  switch (level) {
    case 'debug':
      console.debug(`[${context}]`, logObject);
      break;
    case 'info':
      console.log(`[${context}]`, logObject);
      break;
    case 'warn':
      console.warn(`[${context}]`, logObject);
      break;
    case 'error':
      console.error(`[${context}]`, logObject);
      break;
  }
}

/**
 * Create a copy of an error with secrets masked from its message and stack.
 * Sentry reads `message`/`stack` directly off the Error object, so masking the
 * copy itself (not just metadata) is required to keep secrets off the wire.
 * The caller's error is never mutated; the type name is preserved for grouping.
 */
function maskError(error: Error): Error {
  const masked = new Error(maskSensitiveString(error.message));
  masked.name = error.name;
  masked.stack = error.stack ? maskSensitiveString(error.stack) : undefined;
  return masked;
}

/**
 * Diagnostic metadata keys that are safe to send to Sentry (an external SaaS).
 * Allowlist, not denylist: anything not listed — task `input`, PocketBase
 * `record`, etc. — is dropped so free-text user content never leaves the device.
 */
const SENTRY_SAFE_METADATA_KEYS: ReadonlySet<string> = new Set([
  'correlationId', 'userId', 'taskId', 'deviceId', 'phase', 'operation',
  'action', 'trigger', 'triggeredBy', 'validationErrors', 'componentStack',
  'count', 'attempt', 'status', 'statusCode', 'type', 'url', 'timestamp',
]);

/**
 * Keep only allowlisted, secret-masked diagnostic metadata. This is the single
 * gate that decides what leaves the device for Sentry; anything not listed —
 * task `input`, PocketBase `record`, etc. — is dropped. Exported so other Sentry
 * entry points (e.g. error-logger.ts) reuse this allowlist rather than
 * duplicating the key set.
 */
export function filterSentryMetadata(metadata?: LogMetadata): LogMetadata {
  const allowed: LogMetadata = {};
  for (const key of Object.keys(metadata ?? {})) {
    if (SENTRY_SAFE_METADATA_KEYS.has(key)) {
      allowed[key] = metadata![key];
    }
  }
  return sanitizeMetadata(allowed) ?? {};
}

/**
 * Build the Sentry context: the logger context name plus only the allowlisted,
 * secret-masked diagnostic metadata. Content-bearing keys are stripped.
 */
function buildSentryContext(
  context: LogContext,
  metadata?: LogMetadata
): Record<string, unknown> {
  return { context, ...filterSentryMetadata(metadata) };
}

/**
 * Forward an error log to Sentry. Errors with an Error object are captured as
 * exceptions (using a masked copy); message-only errors as messages. Wrapped so
 * a misconfigured Sentry can never turn an error-log into a thrown exception.
 */
function reportToSentry(
  context: LogContext,
  message: string,
  error?: Error,
  metadata?: LogMetadata
): void {
  try {
    const sentryContext = buildSentryContext(context, metadata);

    if (error) {
      captureException(maskError(error), sentryContext);
    } else {
      captureMessage(maskSensitiveString(message), sentryContext);
    }
  } catch {
    // Telemetry must never break the application's error path.
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
   * Log error message with optional Error object.
   * Logs to the console (structured, masked) and forwards to Sentry so every
   * `logger.error` call is captured for monitoring.
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

      reportToSentry(this.context, message, error, metadata);
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
