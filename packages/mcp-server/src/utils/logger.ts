/**
 * Structured logging utility for GSD MCP Server
 *
 * Uses stderr to avoid corrupting the stdio MCP transport (stdout is used for
 * JSON-RPC messages; only stderr is safe for diagnostic output).
 */

type McpLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: McpLogLevel;
  module: string;
  message: string;
  error?: string;
  stack?: string;
  context?: Record<string, unknown>;
}

function writeLog(entry: LogEntry): void {
  // Write to stderr so it doesn't corrupt the MCP stdio protocol
  process.stderr.write(JSON.stringify(entry) + '\n');
}

function createEntry(
  level: McpLogLevel,
  module: string,
  message: string,
  error?: Error,
  context?: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(error ? { error: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') } : {}),
    ...(context ? { context } : {}),
  };
}

/**
 * Create a scoped structured logger for a specific module
 *
 * @example
 * ```typescript
 * const logger = createMcpLogger('LIST_TASKS');
 * logger.error('Failed to decrypt task', error, { taskId });
 * ```
 */
export function createMcpLogger(module: string) {
  return {
    info: (message: string, context?: Record<string, unknown>) =>
      writeLog(createEntry('INFO', module, message, undefined, context)),

    warn: (message: string, context?: Record<string, unknown>) =>
      writeLog(createEntry('WARN', module, message, undefined, context)),

    error: (message: string, error?: Error, context?: Record<string, unknown>) =>
      writeLog(createEntry('ERROR', module, message, error, context)),

    debug: (message: string, context?: Record<string, unknown>) =>
      writeLog(createEntry('DEBUG', module, message, undefined, context)),
  };
}
