import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useErrorHandler, useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import * as errorLogger from "@/lib/error-logger";

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("@/lib/error-logger", () => ({
  logError: vi.fn(),
  getUserErrorMessage: vi.fn((error, fallback) => fallback),
  ErrorActions: {},
  ErrorMessages: {},
}));

describe("useErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs error with context", () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error("Test error");
    const context = {
      action: "test_action",
      userMessage: "Test failed",
      timestamp: new Date().toISOString(),
    };

    result.current(error, context);

    expect(errorLogger.logError).toHaveBeenCalledWith(error, context);
  });

  it("returns a stable function reference", () => {
    const { result, rerender } = renderHook(() => useErrorHandler());
    const firstHandler = result.current;

    rerender();

    expect(result.current).toBe(firstHandler);
  });
});

describe("useErrorHandlerWithUndo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides handleError function", () => {
    const { result } = renderHook(() => useErrorHandlerWithUndo());

    expect(result.current).toHaveProperty("handleError");
    expect(typeof result.current.handleError).toBe("function");
  });

  it("provides handleSuccess function", () => {
    const { result } = renderHook(() => useErrorHandlerWithUndo());

    expect(result.current).toHaveProperty("handleSuccess");
    expect(typeof result.current.handleSuccess).toBe("function");
  });

  it("logs errors with handleError", () => {
    const { result } = renderHook(() => useErrorHandlerWithUndo());
    const error = new Error("Test error");
    const context = {
      action: "test_action",
      userMessage: "Test failed",
      timestamp: new Date().toISOString(),
    };

    result.current.handleError(error, context);

    expect(errorLogger.logError).toHaveBeenCalledWith(error, context);
  });

  it("returns stable function references", () => {
    const { result, rerender } = renderHook(() => useErrorHandlerWithUndo());
    const { handleError, handleSuccess } = result.current;

    rerender();

    expect(result.current.handleError).toBe(handleError);
    expect(result.current.handleSuccess).toBe(handleSuccess);
  });
});
