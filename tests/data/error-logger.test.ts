import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	logError,
	getUserErrorMessage,
	ErrorActions,
	ErrorMessages,
	type ErrorContext,
	type LoggedError,
} from "@/lib/error-logger";

describe("Error Logger module", () => {
	const originalEnv = process.env.NODE_ENV;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		process.env.NODE_ENV = originalEnv;
	});

	describe("logError", () => {
		it("should structure error with all context fields", () => {
			const error = new Error("Test error");
			const context: ErrorContext = {
				action: ErrorActions.CREATE_TASK,
				taskId: "task-123",
				timestamp: "2025-01-15T12:00:00Z",
				userMessage: "Failed to create task",
				metadata: { foo: "bar" },
			};

			const logged = logError(error, context);

			expect(logged.action).toBe(ErrorActions.CREATE_TASK);
			expect(logged.taskId).toBe("task-123");
			expect(logged.userMessage).toBe("Failed to create task");
			expect(logged.errorType).toBe("Error");
			expect(logged.errorMessage).toBe("Test error");
			expect(logged.stack).toBeDefined();
			expect(logged.metadata).toEqual({ foo: "bar" });
		});

		it("should handle Error instances", () => {
			const error = new Error("Something went wrong");
			const context: ErrorContext = {
				action: "test_action",
				timestamp: new Date().toISOString(),
				userMessage: "Test message",
			};

			const logged = logError(error, context);

			expect(logged.errorType).toBe("Error");
			expect(logged.errorMessage).toBe("Something went wrong");
			expect(logged.stack).toContain("Error");
		});

		it("should handle non-Error objects", () => {
			const error = "String error message";
			const context: ErrorContext = {
				action: "test_action",
				timestamp: new Date().toISOString(),
				userMessage: "Test message",
			};

			const logged = logError(error, context);

			expect(logged.errorType).toBe("UnknownError");
			expect(logged.errorMessage).toBe("String error message");
			expect(logged.stack).toBeUndefined();
		});

		it("should handle custom error types", () => {
			class CustomError extends Error {
				constructor(message: string) {
					super(message);
					this.name = "CustomError";
				}
			}

			const error = new CustomError("Custom error occurred");
			const context: ErrorContext = {
				action: "test_action",
				timestamp: new Date().toISOString(),
				userMessage: "Test message",
			};

			const logged = logError(error, context);

			expect(logged.errorType).toBe("CustomError");
			expect(logged.errorMessage).toBe("Custom error occurred");
		});

		it("should log to console in development mode", () => {
			process.env.NODE_ENV = "development";

			const error = new Error("Dev error");
			const context: ErrorContext = {
				action: "test_action",
				timestamp: "2025-01-15T12:00:00Z",
				userMessage: "Test message",
			};

			logError(error, context);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[GSD Error]",
				expect.objectContaining({
					action: "test_action",
					errorType: "Error",
					errorMessage: "Dev error",
					originalError: error,
				}),
			);
		});

		it("should log minimal info in production mode", () => {
			process.env.NODE_ENV = "production";

			const error = new Error("Prod error");
			const context: ErrorContext = {
				action: "test_action",
				timestamp: "2025-01-15T12:00:00Z",
				userMessage: "Test message",
			};

			logError(error, context);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[GSD Error]",
				expect.objectContaining({
					action: "test_action",
					errorType: "Error",
					errorMessage: "Prod error",
					timestamp: expect.any(String),
				}),
			);

			// Should NOT include originalError in production
			const callArgs = consoleErrorSpy.mock.calls[0][1] as any;
			expect(callArgs.originalError).toBeUndefined();
		});

		it("should include optional fields when provided", () => {
			const error = new Error("Test");
			const context: ErrorContext = {
				action: "test_action",
				taskId: "task-456",
				userId: "user-789",
				timestamp: "2025-01-15T12:00:00Z",
				userMessage: "Test message",
				metadata: { key: "value" },
			};

			const logged = logError(error, context);

			expect(logged.taskId).toBe("task-456");
			expect(logged.userId).toBe("user-789");
			expect(logged.metadata).toEqual({ key: "value" });
		});

		it("should generate a new timestamp when logging", () => {
			const error = new Error("Test");
			const oldTimestamp = "2025-01-15T12:00:00Z";
			const context: ErrorContext = {
				action: "test_action",
				timestamp: oldTimestamp,
				userMessage: "Test message",
			};

			const logged = logError(error, context);

			// The function generates a new timestamp
			expect(logged.timestamp).not.toBe(oldTimestamp);
			expect(logged.timestamp).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
			);
		});

		it("should return complete LoggedError object", () => {
			const error = new Error("Test error");
			const context: ErrorContext = {
				action: ErrorActions.DELETE_TASK,
				taskId: "task-123",
				timestamp: "2025-01-15T12:00:00Z",
				userMessage: "Delete failed",
			};

			const logged = logError(error, context);

			// Verify all required fields are present
			expect(logged).toHaveProperty("action");
			expect(logged).toHaveProperty("errorType");
			expect(logged).toHaveProperty("errorMessage");
			expect(logged).toHaveProperty("timestamp");
			expect(logged).toHaveProperty("userMessage");
			expect(logged).toHaveProperty("taskId");
			expect(logged).toHaveProperty("stack");
		});
	});

	describe("getUserErrorMessage", () => {
		it("should return custom message for 'not found' errors", () => {
			const error = new Error("Item not found in database");
			const message = getUserErrorMessage(error, "Default message");

			expect(message).toBe(
				"The item you're looking for could not be found. It may have been deleted.",
			);
		});

		it("should return custom message for 'Invalid JSON' errors", () => {
			const error = new Error("Invalid JSON format detected");
			const message = getUserErrorMessage(error, "Default message");

			expect(message).toBe(
				"The file format is invalid. Please select a valid export file.",
			);
		});

		it("should return custom message for 'IndexedDB' errors", () => {
			const error = new Error("IndexedDB connection failed");
			const message = getUserErrorMessage(error, "Default message");

			expect(message).toBe(
				"Unable to access local storage. Please check your browser settings.",
			);
		});

		it("should return custom message for ZodError", () => {
			const error = new Error("Validation failed");
			error.name = "ZodError";
			const message = getUserErrorMessage(error, "Default message");

			expect(message).toBe(
				"The data provided is invalid. Please check your input and try again.",
			);
		});

		it("should return default message for unknown errors", () => {
			const error = new Error("Some random error");
			const message = getUserErrorMessage(error, "Something went wrong");

			expect(message).toBe("Something went wrong");
		});

		it("should return default message for non-Error objects", () => {
			const error = "String error";
			const message = getUserErrorMessage(error, "Default message");

			expect(message).toBe("Default message");
		});

		it("should handle errors with partial matches", () => {
			const error = new Error("The requested item was not found");
			const message = getUserErrorMessage(error, "Default");

			expect(message).toBe(
				"The item you're looking for could not be found. It may have been deleted.",
			);
		});
	});

	describe("ErrorActions constants", () => {
		it("should define all task operation actions", () => {
			expect(ErrorActions.CREATE_TASK).toBe("create_task");
			expect(ErrorActions.UPDATE_TASK).toBe("update_task");
			expect(ErrorActions.DELETE_TASK).toBe("delete_task");
			expect(ErrorActions.TOGGLE_TASK).toBe("toggle_task_completion");
			expect(ErrorActions.MOVE_TASK).toBe("move_task_to_quadrant");
		});

		it("should define import/export actions", () => {
			expect(ErrorActions.EXPORT_TASKS).toBe("export_tasks");
			expect(ErrorActions.IMPORT_TASKS).toBe("import_tasks");
			expect(ErrorActions.PARSE_JSON).toBe("parse_import_file");
		});

		it("should define subtask actions", () => {
			expect(ErrorActions.ADD_SUBTASK).toBe("add_subtask");
			expect(ErrorActions.DELETE_SUBTASK).toBe("delete_subtask");
			expect(ErrorActions.TOGGLE_SUBTASK).toBe("toggle_subtask");
		});

		it("should define smart view actions", () => {
			expect(ErrorActions.SAVE_SMART_VIEW).toBe("save_smart_view");
			expect(ErrorActions.DELETE_SMART_VIEW).toBe("delete_smart_view");
			expect(ErrorActions.LOAD_SMART_VIEWS).toBe("load_smart_views");
		});
	});

	describe("ErrorMessages constants", () => {
		it("should define task-related error messages", () => {
			expect(ErrorMessages.TASK_SAVE_FAILED).toBe(
				"Unable to save task. Please try again.",
			);
			expect(ErrorMessages.TASK_DELETE_FAILED).toBe(
				"Failed to delete task. Please try again.",
			);
			expect(ErrorMessages.TASK_UPDATE_FAILED).toBe(
				"Failed to update task state. Please try again.",
			);
			expect(ErrorMessages.TASK_MOVE_FAILED).toBe(
				"Failed to move task. Please try again.",
			);
			expect(ErrorMessages.TASK_RESTORE_FAILED).toBe("Failed to restore task.");
		});

		it("should define import/export error messages", () => {
			expect(ErrorMessages.EXPORT_FAILED).toBe(
				"Export failed. Please try again.",
			);
			expect(ErrorMessages.IMPORT_FAILED).toBe(
				"Import failed. Please select a valid export file.",
			);
			expect(ErrorMessages.IMPORT_INVALID_FORMAT).toBe(
				"Invalid file format. Please select a valid JSON export file.",
			);
		});

		it("should define smart view error messages", () => {
			expect(ErrorMessages.SMART_VIEW_SAVE_FAILED).toBe(
				"Failed to save Smart View. Please try again.",
			);
			expect(ErrorMessages.SMART_VIEW_DELETE_FAILED).toBe(
				"Failed to delete Smart View. Please try again.",
			);
		});

		it("should have clear, user-friendly messages", () => {
			const allMessages = Object.values(ErrorMessages);

			allMessages.forEach((message) => {
				expect(message.length).toBeGreaterThan(10);
				expect(message).toMatch(/[.!]/); // Ends with punctuation
			});
		});
	});
});
