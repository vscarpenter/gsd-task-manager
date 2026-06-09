import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockInit = vi.hoisted(() => vi.fn());
const mockCaptureException = vi.hoisted(() => vi.fn());
const mockCaptureMessage = vi.hoisted(() => vi.fn());
const mockGetClient = vi.hoisted(() => vi.fn());

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

  it("should not initialize Sentry when DSN is empty", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("should call Sentry.captureException when initialized", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new Error("test error");
    captureException(error, { action: "test" });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      contexts: { gsd: { action: "test" } },
    });
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
    expect((capturedError as Error).message).not.toContain("abc123");
    expect((capturedError as Error).message).not.toContain("raw-token");
    expect((capturedError as Error).stack).not.toContain("stack-secret");

    const serializedOptions = JSON.stringify(capturedOptions);
    expect(serializedOptions).not.toContain("query-secret");
    expect(serializedOptions).not.toContain("context-secret");
    expect(serializedOptions).not.toContain("password-secret");
    expect(serializedOptions).toContain("***");
  });

  it("should mask token-bearing custom error properties before capture", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@sentry.io/123";

    const { initSentry, captureException } = await import("@/lib/sentry");
    initSentry();

    const error = new Error("clean message") as Error & { authToken: string };
    error.authToken = "custom-secret";

    captureException(error);

    const [capturedError] = mockCaptureException.mock.calls[0];
    expect(capturedError).not.toBe(error);
    expect((capturedError as { authToken: string }).authToken).toBe("***");
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
      contexts: { gsd: { action: "test" } },
    });
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
