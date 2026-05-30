import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	createLogger,
	Logger,
	generateCorrelationId,
	type LogMetadata,
} from "@/lib/logger";

const mockCaptureException = vi.hoisted(() => vi.fn());
const mockCaptureMessage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sentry", () => ({
	captureException: mockCaptureException,
	captureMessage: mockCaptureMessage,
}));

describe("Logger module", () => {
	let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mockCaptureException.mockClear();
		mockCaptureMessage.mockClear();
	});

	afterEach(() => {
		consoleDebugSpy.mockRestore();
		consoleLogSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		vi.unstubAllEnvs();
	});

	describe("createLogger", () => {
		it("should create a Logger instance with the given context", () => {
			const logger = createLogger("SYNC_ENGINE");
			expect(logger).toBeInstanceOf(Logger);
		});

		it("should create loggers with different contexts", () => {
			const syncLogger = createLogger("SYNC_ENGINE");
			const taskLogger = createLogger("TASK_CRUD");
			const dbLogger = createLogger("DB");

			expect(syncLogger).toBeInstanceOf(Logger);
			expect(taskLogger).toBeInstanceOf(Logger);
			expect(dbLogger).toBeInstanceOf(Logger);
		});

		it("should accept an explicit minimum log level", () => {
			const logger = createLogger("UI", "error");

			// Only error should produce output since minLevel is 'error'
			logger.debug("debug message");
			logger.info("info message");
			logger.warn("warn message");
			logger.error("error message");

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).not.toHaveBeenCalled();
			expect(consoleWarnSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("log levels", () => {
		it("should call console.debug for debug level", () => {
			const logger = createLogger("DB", "debug");
			logger.debug("test debug");

			expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
			expect(consoleDebugSpy).toHaveBeenCalledWith(
				"[DB]",
				expect.objectContaining({
					level: "DEBUG",
					context: "DB",
					message: "test debug",
				}),
			);
		});

		it("should call console.log for info level", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("test info");

			expect(consoleLogSpy).toHaveBeenCalledTimes(1);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[SYNC_ENGINE]",
				expect.objectContaining({
					level: "INFO",
					context: "SYNC_ENGINE",
					message: "test info",
				}),
			);
		});

		it("should call console.warn for warn level", () => {
			const logger = createLogger("AUTH", "debug");
			logger.warn("test warn");

			expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"[AUTH]",
				expect.objectContaining({
					level: "WARN",
					context: "AUTH",
					message: "test warn",
				}),
			);
		});

		it("should call console.error for error level", () => {
			const logger = createLogger("TASK_CRUD", "debug");
			logger.error("test error");

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[TASK_CRUD]",
				expect.objectContaining({
					level: "ERROR",
					context: "TASK_CRUD",
					message: "test error",
				}),
			);
		});

		it("should include a timestamp in log output", () => {
			const logger = createLogger("UI", "debug");
			logger.info("timestamp check");

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[UI]",
				expect.objectContaining({
					timestamp: expect.stringMatching(
						/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
					),
				}),
			);
		});
	});

	describe("log level filtering", () => {
		it("should suppress debug when minLevel is info", () => {
			const logger = createLogger("DB", "info");

			logger.debug("should not appear");
			logger.info("should appear");

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		});

		it("should suppress debug and info when minLevel is warn", () => {
			const logger = createLogger("DB", "warn");

			logger.debug("no");
			logger.info("no");
			logger.warn("yes");
			logger.error("yes");

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).not.toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		});

		it("should only allow error when minLevel is error", () => {
			const logger = createLogger("DB", "error");

			logger.debug("no");
			logger.info("no");
			logger.warn("no");
			logger.error("yes");

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).not.toHaveBeenCalled();
			expect(consoleWarnSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		});

		it("should allow all levels when minLevel is debug", () => {
			const logger = createLogger("DB", "debug");

			logger.debug("d");
			logger.info("i");
			logger.warn("w");
			logger.error("e");

			expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
			expect(consoleLogSpy).toHaveBeenCalledTimes(1);
			expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("environment-aware log levels", () => {
		it("should default to info level in production", () => {
			vi.stubEnv("NODE_ENV", "production");

			const logger = createLogger("SYNC_ENGINE");

			logger.debug("should be suppressed");
			logger.info("should appear");

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		});

		it("should allow debug level in development", () => {
			vi.stubEnv("NODE_ENV", "development");

			const logger = createLogger("SYNC_ENGINE");

			logger.debug("should appear in dev");

			expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("metadata handling", () => {
		it("should include metadata in log output", () => {
			const logger = createLogger("SYNC_PUSH", "debug");
			const metadata: LogMetadata = { correlationId: "abc-123", phase: "push" };

			logger.info("sync started", metadata);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[SYNC_PUSH]",
				expect.objectContaining({
					metadata: expect.objectContaining({
						correlationId: "abc-123",
						phase: "push",
					}),
				}),
			);
		});

		it("should omit metadata key when no metadata is provided", () => {
			const logger = createLogger("UI", "debug");
			logger.info("no metadata");

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			expect(logObject).not.toHaveProperty("metadata");
		});

		it("should omit metadata key when metadata is empty object", () => {
			const logger = createLogger("UI", "debug");
			logger.info("empty metadata", {});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			expect(logObject).not.toHaveProperty("metadata");
		});
	});

	describe("secret sanitization", () => {
		it("should redact fields containing 'token'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("auth event", { authToken: "secret-value-123" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.authToken).toBe("***");
		});

		it("should redact fields containing 'password'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("login", { userPassword: "hunter2" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.userPassword).toBe("***");
		});

		it("should redact fields containing 'secret'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("config", { clientSecret: "shh" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.clientSecret).toBe("***");
		});

		it("should redact fields containing 'apikey'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("config", { apikey: "key-value" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.apikey).toBe("***");
		});

		it("should redact fields containing 'authorization'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("header", { authorization: "Bearer abc" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.authorization).toBe("***");
		});

		it("should redact fields containing 'credential'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("auth", { userCredential: "cred-123" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.userCredential).toBe("***");
		});

		it("should redact fields containing 'cookie'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("request", { sessionCookie: "abc=xyz" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.sessionCookie).toBe("***");
		});

		it("should redact fields containing 'session'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("request", { sessionId: "sess-456" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.sessionId).toBe("***");
		});

		it("should redact fields containing 'email'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("user", { email: "user@example.com" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.email).toBe("***");
		});

		it("should redact fields containing 'passphrase'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("encryption", { passphrase: "my-secret-phrase" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.passphrase).toBe("***");
		});

		it("should redact fields containing 'jwt'", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("auth event", { jwt: "eyJhbGciOiJIUzI1NiJ9.payload.sig" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.jwt).toBe("***");
		});

		it("should redact fields containing 'refresh' (standalone, e.g. refreshExpiry)", () => {
			const logger = createLogger("AUTH", "debug");
			// 'refreshExpiry' does NOT contain 'token' — must match on 'refresh' alone
			logger.info("oauth", { refreshExpiry: "rfsh-abc-123" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.refreshExpiry).toBe("***");
		});

		it("should redact fields containing 'access' (standalone, e.g. accessGrant)", () => {
			const logger = createLogger("AUTH", "debug");
			// 'accessGrant' does NOT contain 'token' — must match on 'access' alone
			logger.info("oauth", { accessGrant: "acc-xyz-789" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.accessGrant).toBe("***");
		});

		it("should redact fields containing 'bearer' (standalone, e.g. bearerScheme)", () => {
			const logger = createLogger("AUTH", "debug");
			// 'bearerScheme' does NOT contain 'token' — must match on 'bearer' alone
			logger.info("header", { bearerScheme: "abc-bearer-value" });

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.bearerScheme).toBe("***");
		});

		it("should perform case-insensitive key matching for sanitization", () => {
			const logger = createLogger("AUTH", "debug");
			logger.info("mixed case", {
				AuthToken: "secret1",
				PASSWORD: "secret2",
				ApiKey: "secret3",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.AuthToken).toBe("***");
			expect(metadata.PASSWORD).toBe("***");
			expect(metadata.ApiKey).toBe("***");
		});

		it("should not redact non-sensitive fields", () => {
			const logger = createLogger("TASK_CRUD", "debug");
			logger.info("task update", {
				taskId: "task-123",
				phase: "create",
				correlationId: "corr-456",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.taskId).toBe("task-123");
			expect(metadata.phase).toBe("create");
			expect(metadata.correlationId).toBe("corr-456");
		});
	});

	describe("URL sanitization", () => {
		it("should mask token parameter in URLs", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("request", {
				url: "https://api.example.com/data?token=abc123&page=1",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.url).toBe(
				"https://api.example.com/data?token=***&page=1",
			);
		});

		it("should mask authorization parameter in URLs", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("request", {
				url: "https://api.example.com?authorization=bearer-xyz",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.url).toBe(
				"https://api.example.com?authorization=***",
			);
		});

		it("should mask api_key parameter in URLs", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("request", {
				url: "https://api.example.com?api_key=secret123&format=json",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.url).toBe(
				"https://api.example.com?apikey=***&format=json",
			);
		});

		it("should mask apikey parameter in URLs (no separator)", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("request", {
				url: "https://api.example.com?apikey=key999",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.url).toBe("https://api.example.com?apikey=***");
		});

		it("should preserve URLs without sensitive parameters", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("request", {
				url: "https://api.example.com/tasks?page=1&limit=50",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.url).toBe(
				"https://api.example.com/tasks?page=1&limit=50",
			);
		});

		it("should mask sensitive values in arbitrary string metadata", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.info("request failed", {
				detail:
					"GET https://api.example.com/tasks?token=abc123 with Authorization: Bearer secret-token",
			});

			const logObject = consoleLogSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.detail).toBe(
				"GET https://api.example.com/tasks?token=*** with Authorization: Bearer ***",
			);
		});
	});

	describe("error logging", () => {
		it("should include error details in metadata", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			const testError = new Error("Connection failed");

			logger.error("sync failed", testError, { phase: "push" });

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[SYNC_ENGINE]",
				expect.objectContaining({
					level: "ERROR",
					message: "sync failed",
					metadata: expect.objectContaining({
						phase: "push",
						errorType: "Error",
						errorMessage: "Connection failed",
						stack: expect.stringContaining("Connection failed"),
					}),
				}),
			);
		});

		it("should handle error logging without an Error object", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.error("something went wrong");

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[SYNC_ENGINE]",
				expect.objectContaining({
					level: "ERROR",
					message: "something went wrong",
				}),
			);
		});

		it("should handle error logging with Error but no metadata", () => {
			const logger = createLogger("DB", "debug");
			const testError = new TypeError("Invalid operation");

			logger.error("db failure", testError);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[DB]",
				expect.objectContaining({
					metadata: expect.objectContaining({
						errorType: "TypeError",
						errorMessage: "Invalid operation",
					}),
				}),
			);
		});

		it("should mask secrets embedded in error messages and stacks", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			const testError = new Error(
				"Request failed for https://api.example.com?api_key=secret with Bearer abc123",
			);

			logger.error("sync failed", testError);

			const logObject = consoleErrorSpy.mock.calls[0][1] as Record<
				string,
				unknown
			>;
			const metadata = logObject.metadata as Record<string, unknown>;
			expect(metadata.errorMessage).toBe(
				"Request failed for https://api.example.com?apikey=*** with Bearer ***",
			);
			expect(metadata.stack).not.toContain("secret");
			expect(metadata.stack).not.toContain("abc123");
		});

		it("should preserve custom error type names", () => {
			class SyncError extends Error {
				constructor(message: string) {
					super(message);
					this.name = "SyncError";
				}
			}

			const logger = createLogger("SYNC_ENGINE", "debug");
			const syncError = new SyncError("Sync timeout");

			logger.error("sync issue", syncError);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[SYNC_ENGINE]",
				expect.objectContaining({
					metadata: expect.objectContaining({
						errorType: "SyncError",
					}),
				}),
			);
		});
	});

	describe("Sentry forwarding", () => {
		it("should forward logged errors to Sentry via captureException", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			const error = new Error("Connection failed");

			logger.error("sync failed", error, { phase: "push" });

			expect(mockCaptureException).toHaveBeenCalledTimes(1);
			expect(mockCaptureMessage).not.toHaveBeenCalled();
			const [forwardedError, context] = mockCaptureException.mock.calls[0];
			expect(forwardedError).toBeInstanceOf(Error);
			expect((forwardedError as Error).message).toBe("Connection failed");
			expect(context).toMatchObject({
				context: "SYNC_ENGINE",
				phase: "push",
			});
		});

		it("should preserve the original error type name when forwarding to Sentry", () => {
			class SyncError extends Error {
				constructor(message: string) {
					super(message);
					this.name = "SyncError";
				}
			}

			const logger = createLogger("SYNC_ENGINE", "debug");
			logger.error("sync issue", new SyncError("timeout"));

			const [forwardedError] = mockCaptureException.mock.calls[0];
			expect((forwardedError as Error).name).toBe("SyncError");
		});

		it("should mask secrets in the error and context before forwarding to Sentry", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");
			const error = new Error(
				"auth failed token=abc123 with Bearer xyz789",
			);

			logger.error("login failed", error, {
				url: "https://api.example.com?token=secret123",
			});

			const [forwardedError, context] = mockCaptureException.mock.calls[0];
			const masked = forwardedError as Error;
			expect(masked.message).not.toContain("abc123");
			expect(masked.message).toContain("token=***");
			expect(masked.message).toContain("Bearer ***");
			expect(masked.stack ?? "").not.toContain("abc123");
			expect((context as Record<string, unknown>).url).toBe(
				"https://api.example.com?token=***",
			);
		});

		it("should forward message-only errors to Sentry via captureMessage", () => {
			const logger = createLogger("SYNC_RETRY", "debug");

			logger.error("Cannot record failure: sync config not found");

			expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
			expect(mockCaptureException).not.toHaveBeenCalled();
			const [message, context] = mockCaptureMessage.mock.calls[0];
			expect(message).toBe("Cannot record failure: sync config not found");
			expect(context).toMatchObject({ context: "SYNC_RETRY" });
		});

		it("should mask secrets in message-only forwards to Sentry", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");

			logger.error("request failed with token=abc123");

			const [message] = mockCaptureMessage.mock.calls[0];
			expect(message).toBe("request failed with token=***");
		});

		it("should drop content-bearing metadata keys before forwarding to Sentry", () => {
			const logger = createLogger("TASK_CRUD", "debug");

			logger.error("Task validation failed", undefined, {
				input: { title: "Call oncologist about results" },
				validationErrors: "title required",
			});

			const [, context] = mockCaptureMessage.mock.calls[0];
			const ctx = context as Record<string, unknown>;
			expect(ctx).not.toHaveProperty("input");
			expect(ctx.validationErrors).toBe("title required");
			expect(ctx.context).toBe("TASK_CRUD");
		});

		it("should keep allowlisted diagnostic keys when forwarding to Sentry", () => {
			const logger = createLogger("SYNC_PUSH", "debug");

			logger.error("Push failed", new Error("boom"), {
				taskId: "task-1",
				phase: "push",
				correlationId: "corr-9",
				record: { title: "private note" },
			});

			const [, context] = mockCaptureException.mock.calls[0];
			const ctx = context as Record<string, unknown>;
			expect(ctx.taskId).toBe("task-1");
			expect(ctx.phase).toBe("push");
			expect(ctx.correlationId).toBe("corr-9");
			expect(ctx).not.toHaveProperty("record");
		});

		it("should not forward debug, info, or warn logs to Sentry", () => {
			const logger = createLogger("SYNC_ENGINE", "debug");

			logger.debug("d");
			logger.info("i");
			logger.warn("w");

			expect(mockCaptureException).not.toHaveBeenCalled();
			expect(mockCaptureMessage).not.toHaveBeenCalled();
		});

		it("should not throw when Sentry forwarding fails", () => {
			mockCaptureException.mockImplementationOnce(() => {
				throw new Error("Sentry down");
			});
			const logger = createLogger("SYNC_ENGINE", "debug");

			expect(() =>
				logger.error("boom", new Error("real error")),
			).not.toThrow();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	describe("child logger", () => {
		it("should create a child logger with a different context", () => {
			const parentLogger = createLogger("SYNC_ENGINE", "debug");
			const childLogger = parentLogger.child("SYNC_PUSH");

			expect(childLogger).toBeInstanceOf(Logger);

			childLogger.info("push started");

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[SYNC_PUSH]",
				expect.objectContaining({
					context: "SYNC_PUSH",
				}),
			);
		});

		it("should inherit the minimum log level from parent", () => {
			const parentLogger = createLogger("SYNC_ENGINE", "warn");
			const childLogger = parentLogger.child("SYNC_PULL");

			childLogger.debug("should not appear");
			childLogger.info("should not appear");
			childLogger.warn("should appear");

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleLogSpy).not.toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("generateCorrelationId", () => {
		it("should return a string with timestamp and counter", () => {
			const correlationId = generateCorrelationId();
			expect(correlationId).toMatch(/^\d+-\d+-[a-z0-9]+$/);
		});

		it("should generate unique IDs on successive calls", () => {
			const id1 = generateCorrelationId();
			const id2 = generateCorrelationId();

			expect(id1).not.toBe(id2);
		});

		it("should increment the counter portion", () => {
			const id1 = generateCorrelationId();
			const id2 = generateCorrelationId();

			const counter1 = parseInt(id1.split("-")[1], 10);
			const counter2 = parseInt(id2.split("-")[1], 10);

			expect(counter2).toBe(counter1 + 1);
		});
	});
});
