/**
 * Diagnostic metadata keys that are safe to send to Sentry (an external SaaS).
 * Allowlist, not denylist: anything not listed — task `input`, PocketBase
 * `record`, etc. — is dropped so free-text user content never leaves the device.
 *
 * Lives in its own module because both gates need it — `lib/logger.ts` filters
 * metadata before capture, and `lib/sentry.ts` filters the `gsd` context again
 * in `beforeSend` — and logger tests mock `@/lib/sentry` wholesale, which would
 * erase the set if it lived there.
 */
export const SENTRY_SAFE_METADATA_KEYS: ReadonlySet<string> = new Set([
  'correlationId', 'userId', 'taskId', 'deviceId', 'phase', 'operation',
  'action', 'trigger', 'triggeredBy', 'validationErrors', 'componentStack',
  'count', 'attempt', 'status', 'statusCode', 'type', 'url', 'timestamp',
  'errorCode',
]);
