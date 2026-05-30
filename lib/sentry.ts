import * as Sentry from "@sentry/browser";
import { ENV_CONFIG } from "@/lib/env-config";

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
    error,
    context ? { contexts: { gsd: context } } : undefined
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

  Sentry.captureMessage(message, {
    level: "error",
    ...(context ? { contexts: { gsd: context } } : {}),
  });
}

export function isInitialized(): boolean {
  return !!Sentry.getClient();
}
