import * as Sentry from "@sentry/browser";
import type { Breadcrumb, ErrorEvent } from "@sentry/browser";
import { ENV_CONFIG } from "@/lib/env-config";
import { SENTRY_SAFE_METADATA_KEYS } from "@/lib/sentry-safe-keys";

const REDACTED = "***";
const REDACTED_ERROR_MESSAGE = "Error details redacted";
const CAPTURE_QUERY_KEYS = ["action", "title", "url", "tags"] as const;
const MAX_CONTEXT_DEPTH = 4;
const MAX_CONTEXT_KEYS = 30;
const MAX_CONTEXT_ARRAY_ITEMS = 20;
const MAX_EVENT_BREADCRUMBS = 50;
const MAX_EVENT_EXCEPTIONS = 10;
const MAX_STACK_FRAMES = 100;
// Fixed vocabulary only — names carry no user content. The DOMException names
// cover IndexedDB, AbortController, and permission failures so stackless
// errors from those APIs still group by cause instead of collapsing to "Error".
const SAFE_ERROR_TYPES = new Set([
  "AbortError",
  "AggregateError",
  "ApiError",
  "ClientResponseError",
  "ConstraintError",
  "DataError",
  "DOMException",
  "Error",
  "EvalError",
  "InvalidStateError",
  "NetworkError",
  "NotAllowedError",
  "NotFoundError",
  "PocketBaseError",
  "QuotaExceededError",
  "RangeError",
  "ReferenceError",
  "SecurityError",
  "SyntaxError",
  "TimeoutError",
  "TransactionInactiveError",
  "TypeError",
  "UnknownError",
  "URIError",
  "VersionError",
  "ZodError",
]);
const SAFE_APP_ROUTE_PATHS = new Set([
  "/",
  "/about",
  "/about/",
  "/archive",
  "/archive/",
  "/dashboard",
  "/dashboard/",
  "/install",
  "/install/",
  "/settings",
  "/settings/",
  "/sync-history",
  "/sync-history/",
]);
// `context` is the logger's fixed context name; `logMessage` is the vouched
// copy of an already-masked log message that only our captureMessage writes.
const SAFE_GSD_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  "context",
  "logMessage",
  ...SENTRY_SAFE_METADATA_KEYS,
]);
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

  // Development stays local: dev sessions produced most of the Sentry noise
  // (78% of the highest-volume issue) while never representing real users.
  // To test capture end-to-end, use staging or temporarily lift this gate —
  // see .claude/skills/sentry-verification/SKILL.md.
  if (!dsn || ENV_CONFIG.isDevelopment) {
    return;
  }

  Sentry.init({
    dsn,
    environment: ENV_CONFIG.environment,
    tracesSampleRate: 0.1,
    enabled: true,
    beforeBreadcrumb: sanitizeBreadcrumb,
    beforeSend: sanitizeEvent,
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
 *
 * The masked message rides along as `contexts.gsd.logMessage` because the
 * `beforeSend` allowlist drops the untrusted top-level `message` field; only
 * this vouched copy — written exclusively here, after masking — is promoted
 * back to `message` on the outgoing event.
 */
export function captureMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (!Sentry.getClient()) return;

  const masked = maskSensitiveString(message);
  Sentry.captureMessage(masked, {
    level: "error",
    contexts: {
      gsd: {
        ...(context ? sanitizeContext(context) : {}),
        logMessage: masked,
      },
    },
  });
}

export function isInitialized(): boolean {
  return !!Sentry.getClient();
}

function sanitizeException(error: unknown): Error {
  const sanitized = new Error(REDACTED_ERROR_MESSAGE);
  sanitized.name =
    error instanceof Error ? sanitizeErrorType(error.name) : "Error";

  if (error instanceof Error && typeof error.stack === "string") {
    const frames = error.stack
      .split("\n")
      .slice(1, MAX_STACK_FRAMES + 1)
      .map((line) => maskSensitiveString(line));
    sanitized.stack = [`${sanitized.name}: ${REDACTED_ERROR_MESSAGE}`, ...frames].join("\n");
  } else {
    // A stackless original must stay stackless. Leaving the copy's own stack
    // in place would point every such event at this wrapper and collapse all
    // stackless errors into one misleading Sentry issue.
    sanitized.stack = undefined;
  }

  // Deliberately do not copy custom properties, `cause`, or AggregateError
  // members. They commonly contain raw task/server payloads, and Sentry's
  // LinkedErrors integration otherwise walks them before the final event hook.
  return sanitized;
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(context, new WeakSet(), 0);
}

function sanitizeRecord(
  record: Record<string, unknown>,
  seen: WeakSet<object>,
  depth: number
): Record<string, unknown> {
  if (depth >= MAX_CONTEXT_DEPTH) {
    return { truncated: true };
  }
  if (seen.has(record)) {
    return { circular: true };
  }
  seen.add(record);

  try {
    return Object.fromEntries(
      Object.entries(record)
        .slice(0, MAX_CONTEXT_KEYS)
        .map(([key, value]) => [key, sanitizeValue(value, key, seen, depth + 1)])
    );
  } catch {
    return { redacted: true };
  }
}

function sanitizeValue(
  value: unknown,
  key?: string,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0
): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return maskSensitiveString(value);
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_CONTEXT_DEPTH || seen.has(value)) {
      return { truncated: true };
    }
    seen.add(value);
    return value
      .slice(0, MAX_CONTEXT_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, undefined, seen, depth + 1));
  }

  if (value instanceof Error) {
    return sanitizeException(value);
  }

  if (value && typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>, seen, depth);
  }

  return value;
}

function maskSensitiveString(value: string): string {
  return stripCapturePayload(value)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(SENSITIVE_JSON_PATTERN, `$1${REDACTED}$3`)
    .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, `$1=${REDACTED}`);
}

function stripCapturePayload(value: string): string {
  return stripCaptureFragment(stripCaptureQuery(value));
}

function stripCaptureQuery(value: string): string {
  const queryStart = value.indexOf("?");
  if (queryStart === -1) return value;

  const fragmentStart = value.indexOf("#", queryStart);
  const queryEnd = fragmentStart === -1 ? value.length : fragmentStart;
  const params = new URLSearchParams(value.slice(queryStart + 1, queryEnd));
  if (params.get("action") !== "capture") return value;

  for (const key of CAPTURE_QUERY_KEYS) {
    params.delete(key);
  }

  const query = params.toString();
  const fragment = fragmentStart === -1 ? "" : value.slice(fragmentStart);
  return `${value.slice(0, queryStart)}${query ? `?${query}` : ""}${fragment}`;
}

function stripCaptureFragment(value: string): string {
  const fragmentStart = value.indexOf("#");
  if (fragmentStart === -1) return value;

  const params = new URLSearchParams(value.slice(fragmentStart + 1));
  if (params.get("action") !== "capture") return value;

  for (const key of CAPTURE_QUERY_KEYS) {
    params.delete(key);
  }

  const fragment = params.toString();
  return `${value.slice(0, fragmentStart)}${fragment ? `#${fragment}` : ""}`;
}

function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const sanitized: Breadcrumb = {
    ...(typeof breadcrumb.category === "string"
      ? { category: sanitizeBreadcrumbCategory(breadcrumb.category) }
      : {}),
    ...(typeof breadcrumb.type === "string"
      ? { type: sanitizeBreadcrumbType(breadcrumb.type) }
      : {}),
    ...(breadcrumb.level ? { level: breadcrumb.level } : {}),
    ...(typeof breadcrumb.timestamp === "number" ? { timestamp: breadcrumb.timestamp } : {}),
  };

  const data = sanitizeBreadcrumbData(breadcrumb);
  if (data) {
    sanitized.data = data;
  }
  return sanitized;
}

function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  try {
    const sanitized: ErrorEvent = {
      type: undefined,
      ...(isSafeIdentifier(event.event_id, 64) ? { event_id: event.event_id } : {}),
      ...(typeof event.timestamp === "number" ? { timestamp: event.timestamp } : {}),
      ...(isSafeIdentifier(event.platform, 32) ? { platform: event.platform } : {}),
      ...(event.level ? { level: event.level } : {}),
      ...(isSafeIdentifier(event.environment, 64)
        ? { environment: event.environment }
        : {}),
      ...(isSafeIdentifier(event.release, 128) ? { release: event.release } : {}),
      ...(isSafeIdentifier(event.dist, 64) ? { dist: event.dist } : {}),
    };

    const request = sanitizeEventRequest(event.request);
    if (request) {
      sanitized.request = request;
    }

    const exception = sanitizeEventException(event.exception);
    if (exception) {
      sanitized.exception = exception;
    }

    if (event.breadcrumbs) {
      sanitized.breadcrumbs = event.breadcrumbs
        .slice(-MAX_EVENT_BREADCRUMBS)
        .map((breadcrumb) => sanitizeBreadcrumb(breadcrumb));
    }

    const gsd = sanitizeEventGsdContext(event.contexts);
    if (gsd) {
      const { logMessage, ...rest } = gsd;
      if (typeof logMessage === "string") {
        sanitized.message = logMessage;
      }
      if (Object.keys(rest).length > 0) {
        sanitized.contexts = { gsd: rest };
      }
    }

    return sanitized;
  } catch {
    return minimalSafeEvent(event);
  }
}

function sanitizeBreadcrumbData(
  breadcrumb: Breadcrumb
): Record<string, string | number | boolean> | undefined {
  if (!breadcrumb.data) return undefined;

  if (breadcrumb.category === "navigation") {
    const from =
      typeof breadcrumb.data.from === "string"
        ? sanitizeTelemetryUrl(breadcrumb.data.from)
        : undefined;
    const to =
      typeof breadcrumb.data.to === "string"
        ? sanitizeTelemetryUrl(breadcrumb.data.to)
        : undefined;
    if (!from && !to) return undefined;
    return {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
  }

  if (
    breadcrumb.category === "http" ||
    breadcrumb.category === "fetch" ||
    breadcrumb.category === "xhr"
  ) {
    const url =
      typeof breadcrumb.data.url === "string"
        ? sanitizeTelemetryUrl(breadcrumb.data.url)
        : undefined;
    const method =
      typeof breadcrumb.data.method === "string"
        ? sanitizeHttpMethod(breadcrumb.data.method)
        : undefined;
    const statusCode =
      typeof breadcrumb.data.status_code === "number"
        ? breadcrumb.data.status_code
        : undefined;
    if (!url && !method && statusCode === undefined) return undefined;
    return {
      ...(url ? { url } : {}),
      ...(method ? { method } : {}),
      ...(statusCode !== undefined ? { status_code: statusCode } : {}),
    };
  }

  return undefined;
}

function sanitizeEventRequest(
  request: ErrorEvent["request"]
): ErrorEvent["request"] | undefined {
  if (!request) return undefined;
  const url = typeof request.url === "string" ? sanitizeTelemetryUrl(request.url) : undefined;
  const method =
    typeof request.method === "string" ? sanitizeHttpMethod(request.method) : undefined;
  if (!url && !method) return undefined;
  return {
    ...(url ? { url } : {}),
    ...(method ? { method } : {}),
  };
}

function sanitizeEventException(
  exception: ErrorEvent["exception"]
): ErrorEvent["exception"] | undefined {
  if (!exception?.values?.length) return undefined;

  return {
    values: exception.values.slice(0, MAX_EVENT_EXCEPTIONS).map((value) => {
      const type =
        typeof value.type === "string"
          ? sanitizeErrorType(value.type)
          : "Error";
      const frames = value.stacktrace?.frames
        ?.slice(-MAX_STACK_FRAMES)
        .map((frame) => ({
          ...(typeof frame.filename === "string"
            ? { filename: sanitizeTelemetryUrl(frame.filename, "frame") }
            : {}),
          ...(typeof frame.abs_path === "string"
            ? { abs_path: sanitizeTelemetryUrl(frame.abs_path, "frame") }
            : {}),
          ...(typeof frame.lineno === "number" ? { lineno: frame.lineno } : {}),
          ...(typeof frame.colno === "number" ? { colno: frame.colno } : {}),
          ...(typeof frame.in_app === "boolean" ? { in_app: frame.in_app } : {}),
        }));

      return {
        type,
        value: REDACTED_ERROR_MESSAGE,
        ...(value.mechanism
          ? {
              mechanism: {
                type: "generic",
                ...(typeof value.mechanism.handled === "boolean"
                  ? { handled: value.mechanism.handled }
                  : {}),
              },
            }
          : {}),
        ...(frames?.length ? { stacktrace: { frames } } : {}),
      };
    }),
  };
}

/**
 * Keep only allowlisted keys of the app's own `gsd` context, re-masked. All
 * other contexts (and non-allowlisted gsd keys) stay dropped — they may carry
 * task content from any capture path.
 */
function sanitizeEventGsdContext(
  contexts: ErrorEvent["contexts"]
): Record<string, unknown> | undefined {
  const gsd = contexts?.gsd;
  if (!gsd || typeof gsd !== "object" || Array.isArray(gsd)) {
    return undefined;
  }

  const allowed = Object.fromEntries(
    Object.entries(gsd as Record<string, unknown>).filter(([key]) =>
      SAFE_GSD_CONTEXT_KEYS.has(key)
    )
  );
  if (Object.keys(allowed).length === 0) {
    return undefined;
  }
  return sanitizeRecord(allowed, new WeakSet(), 0);
}

function sanitizeTelemetryUrl(
  value: string,
  purpose: "route" | "frame" = "route"
): string | undefined {
  try {
    const url = new URL(value, "https://telemetry.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    if (
      purpose === "frame" &&
      (url.pathname.startsWith("/_next/static/") ||
        /\.(?:cjs|js|mjs)$/.test(url.pathname))
    ) {
      return url.pathname;
    }
    return SAFE_APP_ROUTE_PATHS.has(url.pathname) ? url.pathname : "/";
  } catch {
    return undefined;
  }
}

function sanitizeHttpMethod(value: string): string | undefined {
  return /^[A-Z]{3,10}$/i.test(value) ? value.toUpperCase() : undefined;
}

function sanitizeErrorType(value: string): string {
  return SAFE_ERROR_TYPES.has(value) ? value : "Error";
}

function sanitizeBreadcrumbCategory(value: string): string {
  return /^(console|fetch|http|navigation|sentry(?:\.[a-z]+)*|ui\.(?:click|input)|xhr)$/.test(
    value
  )
    ? value
    : "unknown";
}

function sanitizeBreadcrumbType(value: string): string {
  return /^(default|error|http|navigation|user)$/.test(value) ? value : "default";
}

function isSafeIdentifier(
  value: string | undefined,
  maxLength: number
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9_.:@/+[\]-]+$/.test(value)
  );
}

function minimalSafeEvent(event: ErrorEvent): ErrorEvent {
  try {
    return isSafeIdentifier(event.event_id, 64)
      ? { type: undefined, event_id: event.event_id }
      : { type: undefined };
  } catch {
    return { type: undefined };
  }
}
