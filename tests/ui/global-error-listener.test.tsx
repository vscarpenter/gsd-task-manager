import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GlobalErrorListener } from "@/components/global-error-listener";

const mockToast = vi.hoisted(() => ({
  error: vi.fn(),
}));

const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/lib/sentry", () => ({
  captureException: mockCaptureException,
  captureMessage: vi.fn(),
}));

describe("GlobalErrorListener", () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventSpy = vi.spyOn(window, "addEventListener");
    removeEventSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    cleanup();
    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
  });

  it("should render nothing", () => {
    const { container } = render(<GlobalErrorListener />);
    expect(container.innerHTML).toBe("");
  });

  it("should register unhandledrejection listener on mount", () => {
    render(<GlobalErrorListener />);
    expect(addEventSpy).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );
  });

  it("should remove listener on unmount", () => {
    const { unmount } = render(<GlobalErrorListener />);
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );
  });

  it("should not manually capture a rejection already owned by Sentry", () => {
    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("async failure"),
    });
    handler(event);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("should show toast for unhandled rejection", () => {
    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: new Error("async failure"),
    });
    handler(event);

    expect(mockToast.error).toHaveBeenCalledWith("An unexpected error occurred");
  });

  it("should handle non-Error rejection values", () => {
    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    const event = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: "string error",
    });
    handler(event);

    expect(mockToast.error).toHaveBeenCalledWith("An unexpected error occurred");
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("should throttle rapid successive rejections", () => {
    render(<GlobalErrorListener />);

    const handler = addEventSpy.mock.calls.find(
      (c) => c[0] === "unhandledrejection"
    )?.[1] as EventListener;

    for (let i = 0; i < 5; i++) {
      const event = new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: new Error(`error ${i}`),
      });
      handler(event);
    }

    expect(mockToast.error).toHaveBeenCalledTimes(1);
  });
});
