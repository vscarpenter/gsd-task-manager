import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import * as errorLogger from "@/lib/error-logger";
import { TOAST_DURATION } from "@/lib/constants";
import { useErrorHandler, useErrorHandlerWithUndo } from "@/lib/use-error-handler";

const mockToast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));

vi.mock("sonner", () => ({
  toast: mockToast,
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

  it("shows the derived user message through sonner", () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error("Test error");
    const context = {
      action: "test_action",
      userMessage: "Fallback message",
      timestamp: new Date().toISOString(),
    };
    vi.mocked(errorLogger.getUserErrorMessage).mockReturnValueOnce("Friendly message");

    result.current(error, context);

    expect(errorLogger.getUserErrorMessage).toHaveBeenCalledWith(error, "Fallback message");
    expect(mockToast.error).toHaveBeenCalledWith(
      "Friendly message",
      { duration: TOAST_DURATION.LONG }
    );
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

  it("shows handleError messages through sonner", () => {
    const { result } = renderHook(() => useErrorHandlerWithUndo());
    const error = new Error("Test error");
    const context = {
      action: "test_action",
      userMessage: "Fallback message",
      timestamp: new Date().toISOString(),
    };
    vi.mocked(errorLogger.getUserErrorMessage).mockReturnValueOnce("Friendly message");

    result.current.handleError(error, context);

    expect(mockToast.error).toHaveBeenCalledWith(
      "Friendly message",
      { duration: TOAST_DURATION.LONG }
    );
  });

  it("shows a success toast with an undo action", async () => {
    const { result } = renderHook(() => useErrorHandlerWithUndo());
    const undoAction = vi.fn().mockResolvedValue(undefined);

    result.current.handleSuccess("Task deleted", undoAction, 1234);

    expect(mockToast).toHaveBeenCalledWith(
      "Task deleted",
      expect.objectContaining({
        duration: 1234,
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      })
    );

    const toastOptions = mockToast.mock.calls[0][1];
    await toastOptions.action.onClick();

    expect(undoAction).toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("logs undo failures and shows a short error toast", async () => {
    const { result } = renderHook(() => useErrorHandlerWithUndo());
    const undoError = new Error("Undo failed");

    result.current.handleSuccess(
      "Task deleted",
      vi.fn().mockRejectedValue(undoError)
    );

    const toastOptions = mockToast.mock.calls[0][1];
    await toastOptions.action.onClick();

    expect(errorLogger.logError).toHaveBeenCalledWith(
      undoError,
      expect.objectContaining({
        action: "undo_operation",
        userMessage: "Failed to undo operation",
        timestamp: expect.any(String),
      })
    );
    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to undo operation",
      { duration: TOAST_DURATION.SHORT }
    );
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
