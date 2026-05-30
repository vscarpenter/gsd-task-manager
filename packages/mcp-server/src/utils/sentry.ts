/**
 * Opt-in Sentry error reporting for the GSD MCP Server.
 *
 * Activates ONLY when the user sets their own `GSD_SENTRY_DSN`; absent that, every
 * function here is a no-op and nothing leaves the machine. Secrets (the PocketBase
 * `Authorization: Bearer <token>`) are masked before any forward, and Sentry is
 * configured to never write to stdout (which carries the JSON-RPC stdio transport).
 */

import * as Sentry from '@sentry/node';
import { VERSION } from '../version.js';

const SENSITIVE_QUERY_PARAMS_PATTERN =
  /token=[^&\s]+|authorization=[^&\s]+|api[_-]?key=[^&\s]+/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

/** Mask auth tokens from a string before it leaves the machine. */
export function maskSecrets(value: string): string {
  return value
    .replace(SENSITIVE_QUERY_PARAMS_PATTERN, (match) => {
      const lower = match.toLowerCase();
      if (lower.startsWith('authorization=')) return 'authorization=***';
      if (lower.startsWith('token=')) return 'token=***';
      return 'apikey=***';
    })
    .replace(BEARER_TOKEN_PATTERN, 'Bearer ***');
}

/** Copy an error with secrets masked from its message and stack; name preserved. */
function maskError(error: Error): Error {
  const masked = new Error(maskSecrets(error.message));
  masked.name = error.name;
  masked.stack = error.stack ? maskSecrets(error.stack) : undefined;
  return masked;
}

/** Initialize Sentry only when the user opts in via their own GSD_SENTRY_DSN. */
export function initSentry(): void {
  const dsn = process.env.GSD_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: `gsd-mcp-server@${VERSION}`,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0,
    debug: false,
  });
}

/** Send an exception to Sentry (no-op unless initialized). Secrets are masked. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!Sentry.getClient()) return;

  const safe =
    error instanceof Error
      ? maskError(error)
      : typeof error === 'string'
        ? maskSecrets(error)
        : error;

  Sentry.captureException(
    safe,
    context ? { contexts: { gsd: context } } : undefined,
  );
}

/** Send a string message to Sentry at error level (no-op unless initialized). */
export function captureMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (!Sentry.getClient()) return;

  Sentry.captureMessage(maskSecrets(message), {
    level: 'error',
    ...(context ? { contexts: { gsd: context } } : {}),
  });
}

/** Flush queued events before the process exits. No-op unless initialized. */
export function flush(timeoutMs = 2000): Promise<boolean> {
  if (!Sentry.getClient()) return Promise.resolve(true);
  return Sentry.flush(timeoutMs);
}
