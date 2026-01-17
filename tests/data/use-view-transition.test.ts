import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewTransition } from "@/lib/use-view-transition";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("useViewTransition", () => {
  let originalStartViewTransition: typeof document.startViewTransition;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save original startViewTransition if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalStartViewTransition = (document as any).startViewTransition;
  });

  afterEach(() => {
    // Restore original startViewTransition
    if (originalStartViewTransition) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (document as any).startViewTransition;
    }
  });

  it("returns navigateWithTransition function and isPending state", () => {
    const { result } = renderHook(() => useViewTransition());

    expect(result.current).toHaveProperty("navigateWithTransition");
    expect(result.current).toHaveProperty("isPending");
    expect(typeof result.current.navigateWithTransition).toBe("function");
    expect(typeof result.current.isPending).toBe("boolean");
  });

  it("detects when View Transition API is not supported", () => {
    // Ensure startViewTransition is not available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition;

    const { result } = renderHook(() => useViewTransition());

    act(() => {
      result.current.navigateWithTransition("/dashboard");
    });

    // Should fall back to direct router.push
    expect(mockPush).toHaveBeenCalledWith("/dashboard/");
  });

  it("uses View Transition API when supported", () => {
    const mockStartViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).startViewTransition = mockStartViewTransition;

    const { result } = renderHook(() => useViewTransition());

    act(() => {
      result.current.navigateWithTransition("/dashboard");
    });

    // Should use startViewTransition
    expect(mockStartViewTransition).toHaveBeenCalledWith(expect.any(Function));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/");
  });

  it("normalizes routes by adding trailing slash", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition;

    const { result } = renderHook(() => useViewTransition());

    act(() => {
      result.current.navigateWithTransition("/about");
    });

    expect(mockPush).toHaveBeenCalledWith("/about/");
  });

  it("does not add trailing slash to root route", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition;

    const { result } = renderHook(() => useViewTransition());

    act(() => {
      result.current.navigateWithTransition("/");
    });

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("does not add trailing slash if already present", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition;

    const { result } = renderHook(() => useViewTransition());

    act(() => {
      result.current.navigateWithTransition("/dashboard/");
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard/");
  });

  it("executes callback within startViewTransition when supported", () => {
    let callbackExecuted = false;
    const mockStartViewTransition = vi.fn((callback: () => void) => {
      callback();
      callbackExecuted = true;
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).startViewTransition = mockStartViewTransition;

    const { result } = renderHook(() => useViewTransition());

    act(() => {
      result.current.navigateWithTransition("/settings");
    });

    expect(callbackExecuted).toBe(true);
    expect(mockStartViewTransition).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/settings/");
  });

  it("handles navigation without View Transition API gracefully", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition;

    const { result } = renderHook(() => useViewTransition());

    // Should not throw error
    expect(() => {
      act(() => {
        result.current.navigateWithTransition("/profile");
      });
    }).not.toThrow();

    expect(mockPush).toHaveBeenCalledWith("/profile/");
  });
});
