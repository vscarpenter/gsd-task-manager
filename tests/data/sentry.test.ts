import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockInit = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());
const mockCaptureMessage = vi.hoisted(() => vi.fn());
const mockGetClient = vi.hoisted(() => vi.fn());

interface TestBreadcrumb {
  category?: string;
  type?: string;
  level?: string;
  timestamp?: number;
  message?: string;
  data?: Record<string, unknown>;
}

interface TestEvent {
  event_id?: string;
  timestamp?: number;
  platform?: string;
  level?: string;
  environment?: string;
  release?: string;
  message?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
    query_string?: string;
  };
  breadcrumbs?: TestBreadcrumb[];
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      mechanism?: { type?: string; handled?: boolean; data?: Record<string, unknown> };
      stacktrace?: {
        frames?: Array<{
          filename?: string;
          abs_path?: string;
          function?: string;
          module?: string;
          package?: string;
          lineno?: number;
          colno?: number;
          in_app?: boolean;
          vars?: Record<string, unknown>;
          context_line?: string;
        }>;
      };
    }>;
  };
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  user?: Record<string, unknown>;
}

interface TestSentryOptions {
  beforeBreadcrumb?: (breadcrumb: TestBreadcrumb) => TestBreadcrumb | null;
  beforeSend?: (event: TestEvent) => TestEvent | null;
}

const mockEnvConfig = vi.hoisted(() => ({
  environment: "production",
  isDevelopment: false,
  isProduction: true,
  isStaging: false,
  pocketBaseUrl: "https://api.vinny.io",
}));

vi.mock("@/lib/env-config", () => ({
  ENV_CONFIG: mockEnvConfig,
}));

vi.mock("@sentry/browser", () => ({
  init: (...args: unknown[]) => {
    mockInit(...args);
    mockGetClient.mockReturnValue({});
  },
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  getClient: mockGetClient,
}));

describe("Sentry wrapper", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetClient.mockReturnValue(undefined);
    mockEnvConfig.environment = "production";
    mockEnvConfig.isDevelopment = false;
    mockEnvConfig.isProduction = true;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    }
  });

  it("should initialize Sentry when DSN is provided", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@sentry.io/123",
        enabled: true,
      })
    );
  });

  it("should not initialize Sentry in development", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";
    mockEnvConfig.environment = "development";
    mockEnvConfig.isDevelopment = true;
    mockEnvConfig.isProduction = false;

    const { initSentry, isInitialized } = await import("@/lib/sentry");
    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
    expect(isInitialized()).toBe(false);
  });

  it("should not initialize Sentry when DSN is empty", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("should reduce navigation breadcrumbs and event URLs to path-only telemetry", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const legacyCaptureUrl =
      "/?action=capture&title=Private%20roadmap&url=https%3A%2F%2Finternal.example%2Fplan&tags=secret&keep=1";
    const fragmentCaptureUrl =
      "/#action=capture&title=Private%20roadmap&url=https%3A%2F%2Finternal.example%2Fplan&tags=secret&keep=1";
    const breadcrumb = options.beforeBreadcrumb?.({
      category: "navigation",
      message: "Private roadmap",
      data: { from: fragmentCaptureUrl, to: "/?keep=1" },
    });
    const event = options.beforeSend?.({
      request: { url: `https://gsd.vinny.dev${legacyCaptureUrl}` },
      breadcrumbs: [
        {
          category: "navigation",
          message: "Private roadmap",
          data: { from: fragmentCaptureUrl, to: "/?keep=1" },
        },
      ],
    });

    expect(breadcrumb?.message).toBeUndefined();
    expect(breadcrumb?.data?.from).toBe("/");
    expect(event?.request?.url).toBe("/");
    expect(event?.breadcrumbs?.[0]?.data?.from).toBe("/");
    expect(JSON.stringify({ breadcrumb, event })).not.toContain("Private");
    expect(JSON.stringify({ breadcrumb, event })).not.toContain("internal.example");
    expect(JSON.stringify({ breadcrumb, event })).not.toContain("secret");
  });

  it("should capture a privacy-safe exception copy when initialized", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new Error("test error");
    captureException(error, { action: "test" });

    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error), {
      contexts: { gsd: { action: "test" } },
    });
    const [capturedError] = mockCaptureException.mock.calls[0] as [Error];
    expect(capturedError).not.toBe(error);
    expect(capturedError.name).toBe("Error");
    expect(capturedError.message).toBe("Error details redacted");
    expect(capturedError.stack).not.toContain("test error");
  });

  it("should mask token-bearing exception details and context before capture", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new Error("failed with token=abc123 and Bearer raw-token");
    error.stack = "Error: failed\n    at call (https://app.test?access_token=stack-secret)";

    captureException(error, {
      url: "https://api.test/tasks?token=query-secret",
      authToken: "context-secret",
      nested: {
        password: "password-secret",
      },
    });

    const [capturedError, capturedOptions] = mockCaptureException.mock.calls[0];
    expect(capturedError).not.toBe(error);
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe("Error details redacted");
    expect((capturedError as Error).stack).not.toContain("stack-secret");

    const serializedOptions = JSON.stringify(capturedOptions);
    expect(serializedOptions).not.toContain("query-secret");
    expect(serializedOptions).not.toContain("context-secret");
    expect(serializedOptions).not.toContain("password-secret");
    expect(serializedOptions).toContain("***");
  });

  it("should not substitute its own stack for a stackless error", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new TypeError("native failure with no frames");
    error.stack = undefined;
    captureException(error);

    const [capturedError] = mockCaptureException.mock.calls[0] as [Error];
    expect(capturedError.name).toBe("TypeError");
    expect(capturedError.stack).toBeUndefined();
  });

  it("should preserve well-known DOMException names for grouping", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new Error("quota hit");
    error.name = "QuotaExceededError";
    captureException(error);

    const [capturedError] = mockCaptureException.mock.calls[0] as [Error];
    expect(capturedError.name).toBe("QuotaExceededError");
  });

  it("should drop custom error properties, causes, and AggregateError members", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const nested = new Error("NESTED_TASK_SENTINEL");
    const cause = new Error("CAUSE_TASK_SENTINEL");
    const error = new AggregateError(
      [nested, { task: "OBJECT_TASK_SENTINEL" }],
      "ROOT_TASK_SENTINEL",
      { cause }
    ) as AggregateError & { taskTitle: string };
    error.taskTitle = "PROPERTY_TASK_SENTINEL";

    captureException(error);

    const [capturedError] = mockCaptureException.mock.calls[0] as [Error];
    expect(capturedError).not.toBe(error);
    expect(capturedError.message).toBe("Error details redacted");
    expect(capturedError.name).toBe("AggregateError");
    expect(Object.hasOwn(capturedError, "cause")).toBe(false);
    expect(Object.hasOwn(capturedError, "errors")).toBe(false);
    expect(Object.hasOwn(capturedError, "taskTitle")).toBe(false);
    expect(`${capturedError.message}\n${capturedError.stack ?? ""}`).not.toContain(
      "TASK_SENTINEL"
    );
  });

  it("should project outgoing events onto a privacy-safe allowlist", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const rawSentinel = "TASK_SENTINEL_7f3b";
    const encodedSentinel = "TASK%5FSENTINEL%5F7f3b";
    const base64Sentinel = "VEFTS19TRU5USU5FTF83ZjNi";
    const event = options.beforeSend?.({
      event_id: "safe-event-id",
      timestamp: 1234,
      platform: "javascript",
      level: "error",
      environment: "production",
      release: "10.4.1",
      message: rawSentinel,
      request: {
        url: `https://gsd.test/tasks/${rawSentinel}?action=capture&title=${encodedSentinel}`,
        method: "POST",
        headers: { authorization: `Bearer ${rawSentinel}` },
        data: { taskTitle: rawSentinel },
        query_string: `task=${base64Sentinel}`,
      },
      exception: {
        values: [
          {
            type: "PocketBaseError",
            value: rawSentinel,
            mechanism: {
              type: "generic",
              handled: true,
              data: { original: rawSentinel },
            },
            stacktrace: {
              frames: [
                {
                  filename: `https://gsd.test/_next/static/chunk.js?token=${rawSentinel}`,
                  abs_path: `https://gsd.test/_next/static/chunk.js#${base64Sentinel}`,
                  function: rawSentinel,
                  module: base64Sentinel,
                  package: "gsd",
                  lineno: 42,
                  colno: 7,
                  in_app: true,
                  vars: { title: rawSentinel },
                  context_line: rawSentinel,
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        { category: "console", message: rawSentinel, data: { payload: rawSentinel } },
      ],
      contexts: { gsd: { taskTitle: rawSentinel } },
      extra: { cause: rawSentinel },
      tags: { task: rawSentinel },
      user: { id: rawSentinel, email: `${rawSentinel}@example.com` },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(rawSentinel);
    expect(serialized).not.toContain(encodedSentinel);
    expect(serialized).not.toContain(base64Sentinel);
    expect(event).toMatchObject({
      event_id: "safe-event-id",
      timestamp: 1234,
      platform: "javascript",
      level: "error",
      environment: "production",
      release: "10.4.1",
      request: {
        url: "/",
        method: "POST",
      },
    });
    expect(event?.message).toBeUndefined();
    expect(event?.exception?.values?.[0]?.value).toBe("Error details redacted");
    expect(event?.exception?.values?.[0]?.mechanism).toEqual({
      type: "generic",
      handled: true,
    });
    expect(event?.exception?.values?.[0]?.stacktrace?.frames?.[0]).toMatchObject({
      filename: "/_next/static/chunk.js",
      abs_path: "/_next/static/chunk.js",
      lineno: 42,
      colno: 7,
      in_app: true,
    });
    expect(event?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.function).toBeUndefined();
    expect(event?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.module).toBeUndefined();
    expect(event?.contexts).toBeUndefined();
    expect(event?.extra).toBeUndefined();
    expect(event?.tags).toBeUndefined();
    expect(event?.user).toBeUndefined();
  });

  it("should label React minified errors by number instead of generic redaction", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const event = options.beforeSend?.({
      level: "error",
      exception: {
        values: [
          {
            type: "Error",
            value:
              "Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]=TASK_ARG_SENTINEL for the full message",
            mechanism: { type: "onerror", handled: false },
          },
        ],
      },
    });

    expect(event?.exception?.values?.[0]?.value).toBe(
      "React minified error #418 (hydration mismatch)"
    );
    expect(JSON.stringify(event)).not.toContain("TASK_ARG_SENTINEL");
  });

  it("should restore the vouched log message and keep allowlisted gsd context keys", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const event = options.beforeSend?.({
      level: "error",
      message: "RAW_MESSAGE_SENTINEL",
      contexts: {
        gsd: {
          context: "sync-engine",
          taskId: "TASK_ID_SENTINEL",
          userId: "USER_ID_SENTINEL",
          deviceId: "DEVICE_ID_SENTINEL",
          logMessage: "Sync failed",
          action: "manual",
          errorCode: "network_error",
          taskTitle: "TASK_TITLE_SENTINEL",
          input: "INPUT_SENTINEL",
        },
      },
    });

    expect(event?.message).toBe("Sync failed");
    expect(event?.contexts).toEqual({
      gsd: { context: "sync-engine", action: "manual", errorCode: "network_error" },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("RAW_MESSAGE_SENTINEL");
    expect(serialized).not.toContain("TASK_TITLE_SENTINEL");
    expect(serialized).not.toContain("INPUT_SENTINEL");
    expect(serialized).not.toContain("TASK_ID_SENTINEL");
    expect(serialized).not.toContain("USER_ID_SENTINEL");
    expect(serialized).not.toContain("DEVICE_ID_SENTINEL");
  });

  it("should keep only structural HTTP breadcrumb data", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const breadcrumb = options.beforeBreadcrumb?.({
      category: "http",
      type: "http",
      message: "TASK_SENTINEL_HTTP",
      data: {
        url: "https://api.example/tasks/TASK_SENTINEL_HTTP?token=secret",
        method: "get",
        status_code: 503,
        body: "TASK_SENTINEL_HTTP",
      },
    });

    expect(breadcrumb).toEqual({
      category: "http",
      type: "http",
      data: {
        url: "/",
        method: "GET",
        status_code: 503,
      },
    });
    expect(JSON.stringify(breadcrumb)).not.toContain("TASK_SENTINEL_HTTP");
  });

  it("should not inspect dropped event fields with throwing accessors", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const event = { event_id: "safe-event-id" } as TestEvent;
    Object.defineProperty(event, "extra", {
      get: () => {
        throw new Error("PRIVATE_ACCESSOR_SENTINEL");
      },
    });

    expect(() => options.beforeSend?.(event)).not.toThrow();
    expect(options.beforeSend?.(event)).toEqual({
      type: undefined,
      event_id: "safe-event-id",
    });
  });

  it("should fail closed when a retained event field throws", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    const options = mockInit.mock.calls[0]?.[0] as TestSentryOptions;
    const event = { event_id: "safe-event-id" } as TestEvent;
    Object.defineProperty(event, "request", {
      get: () => {
        throw new Error("PRIVATE_REQUEST_SENTINEL");
      },
    });

    expect(options.beforeSend?.(event)).toEqual({
      type: undefined,
      event_id: "safe-event-id",
    });
  });

  it("should not call Sentry.captureException when not initialized", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    captureException(new Error("test"), { action: "test" });

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("should call Sentry.captureMessage with error level when initialized", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureMessage } = await import("@/lib/sentry");
    initSentry();

    captureMessage("something went wrong", { action: "test" });

    expect(mockCaptureMessage).toHaveBeenCalledWith("something went wrong", {
      level: "error",
      contexts: { gsd: { action: "test", logMessage: "something went wrong" } },
    });
  });

  it("should embed a vouched masked copy of the message for beforeSend", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureMessage } = await import("@/lib/sentry");
    initSentry();

    captureMessage("sync failed with token=abc123", { action: "push" });

    const [, capturedOptions] = mockCaptureMessage.mock.calls[0] as [
      string,
      { contexts?: { gsd?: Record<string, unknown> } },
    ];
    expect(capturedOptions.contexts?.gsd?.logMessage).toBe("sync failed with token=***");
    expect(capturedOptions.contexts?.gsd?.action).toBe("push");
  });

  it("should mask token-bearing messages and message context before capture", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureMessage } = await import("@/lib/sentry");
    initSentry();

    captureMessage("failed with refresh_token=refresh-secret and Bearer message-token", {
      apiKey: "context-secret",
    });

    const [capturedMessage, capturedOptions] = mockCaptureMessage.mock.calls[0];
    expect(capturedMessage).not.toContain("refresh-secret");
    expect(capturedMessage).not.toContain("message-token");
    expect(JSON.stringify(capturedOptions)).not.toContain("context-secret");
    expect(JSON.stringify(capturedOptions)).toContain("***");
  });

  it("should not call Sentry.captureMessage when not initialized", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { initSentry, captureMessage } = await import("@/lib/sentry");
    initSentry();

    captureMessage("noop", { action: "test" });

    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("should report initialization state via isInitialized()", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const mod1 = await import("@/lib/sentry");
    mod1.initSentry();
    expect(mod1.isInitialized()).toBe(false);

    vi.resetModules();
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const mod2 = await import("@/lib/sentry");
    mod2.initSentry();
    expect(mod2.isInitialized()).toBe(true);
  });
});
