import * as Sentry from "@sentry/browser";
import { ENV_CONFIG } from "@/lib/env-config";

let initialized = false;

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

  initialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;

  Sentry.captureException(
    error,
    context ? { contexts: { gsd: context } } : undefined
  );
}

export function isInitialized(): boolean {
  return initialized;
}
