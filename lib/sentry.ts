import * as Sentry from "@sentry/browser";
import { ENV_CONFIG } from "@/lib/env-config";

const REDACTED = "***";
const SENSITIVE_KEY_PATTERN =
  /(?:password|passcode|secret|token|api[_-]?key|apikey|authorization|auth|session|cookie|refresh|access[_-]?token)/i;
const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b(access_token|refresh_token|token|auth|password|secret|api_key|apiKey|apikey|authorization)=([^&\s"',}]+)/gi;
const SENSITIVE_QUERY_PATTERN =
  /([?&](?:access_token|refresh_token|token|auth|password|secret|api_key|apiKey|apikey|authorization)=)([^&\s]+)/gi;
const SENSITIVE_JSON_PATTERN =
  /("(?:access_token|refresh_token|token|auth|password|secret|api_key|apiKey|apikey|authorization)"\s*:\s*")([^"]+)(")/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function initSentry(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: ENV_CONFIG.environment,
    tracesSampleRate: 0.1,
    enabled: true,
  });
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!Sentry.getClient()) return;

  Sentry.captureException(
    sanitizeException(error),
    context ? { contexts: { gsd: sanitizeContext(context) } } : undefined
  );
}

/**
 * Capture a string message as an error-level Sentry event.
 * Used for logged errors that carry no Error object (e.g. validation failures).
 */
export function captureMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (!Sentry.getClient()) return;

  Sentry.captureMessage(maskSensitiveString(message), {
    level: "error",
    ...(context ? { contexts: { gsd: sanitizeContext(context) } } : {}),
  });
}

export function isInitialized(): boolean {
  return !!Sentry.getClient();
}

function sanitizeException(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return sanitizeValue(error);
  }

  const maskedName = maskSensitiveString(error.name);
  const maskedMessage = maskSensitiveString(error.message);
  const maskedStack =
    typeof error.stack === "string" ? maskSensitiveString(error.stack) : error.stack;
  const originalEntries = Object.entries(error);
  const sanitizedEntries = originalEntries.map(
    ([key, value]) => [key, sanitizeValue(value, key)] as const
  );
  const propsChanged = sanitizedEntries.some(
    ([, value], index) => value !== originalEntries[index]?.[1]
  );

  if (
    maskedName === error.name &&
    maskedMessage === error.message &&
    maskedStack === error.stack &&
    !propsChanged
  ) {
    return error;
  }

  const sanitized = new Error(maskedMessage);
  sanitized.name = maskedName;
  sanitized.stack = maskedStack;

  for (const [key, value] of sanitizedEntries) {
    (sanitized as unknown as Record<string, unknown>)[key] = value;
  }

  return sanitized;
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(context, new WeakSet());
}

function sanitizeRecord(
  record: Record<string, unknown>,
  seen: WeakSet<object>
): Record<string, unknown> {
  if (seen.has(record)) {
    return { circular: true };
  }
  seen.add(record);

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, sanitizeValue(value, key, seen)])
  );
}

function sanitizeValue(
  value: unknown,
  key?: string,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return maskSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, undefined, seen));
  }

  if (value instanceof Error) {
    return sanitizeException(value);
  }

  if (value && typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>, seen);
  }

  return value;
}

function maskSensitiveString(value: string): string {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(SENSITIVE_JSON_PATTERN, `$1${REDACTED}$3`)
    .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, `$1=${REDACTED}`);
}
