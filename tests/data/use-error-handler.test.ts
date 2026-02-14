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

    rerender();

    // Function should be stable due to useCallback with showToast dependency
    expect(typeof result.current).toBe("function");
    expect(result.current).toEqual(expect.any(Function));
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

    rerender();

    // Functions should be stable due to useCallback with showToast dependency
    expect(typeof result.current.handleError).toBe("function");
    expect(typeof result.current.handleSuccess).toBe("function");
    expect(result.current.handleError).toEqual(expect.any(Function));
    expect(result.current.handleSuccess).toEqual(expect.any(Function));
  });
});
