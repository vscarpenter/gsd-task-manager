import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	createLogger,
	Logger,
	generateCorrelationId,
	type LogMetadata,
} from "@/lib/logger";

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
			expect(correlationId).toMatch(/^\d+-\d+$/);
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
