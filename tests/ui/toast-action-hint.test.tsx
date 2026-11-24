import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { ThemedToaster } from "@/components/ui/themed-toaster";

const HINT = "Press Alt+T, then Tab until you reach Undo.";

function showUndoToast(): string | number {
  return toast.success("Task completed", { duration: Infinity, action: { label: "Undo", onClick: () => {} } });
}

async function settleToasts(): Promise<void> {
  await act(async () => { await vi.runAllTimersAsync(); });
}

describe("toast action keyboard hint", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  afterEach(async () => {
    try {
      act(() => { toast.dismiss(); });
      // Sonner's removal callbacks must finish before JSDOM closes.
      await settleToasts();
      cleanup();
      await settleToasts();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("tells a screen reader how to reach the action when a toast carries one", async () => {
    render(<ThemedToaster />);
    act(() => { showUndoToast(); });
    await settleToasts();

    const hint = screen.getByText(HINT);
    expect(hint.closest("[role='status']")).toHaveAttribute("aria-live", "polite");
  });

  it("stays silent for a toast with no action", async () => {
    render(<ThemedToaster />);
    act(() => { toast.success("Task duplicated", { duration: Infinity }); });
    await settleToasts();

    expect(screen.queryByText(/Alt\+T/)).not.toBeInTheDocument();
  });

  it("clears the hint once the action toast is gone, so the next one is announced again", async () => {
    render(<ThemedToaster />);
    let id: string | number = "";
    act(() => { id = showUndoToast(); });
    await settleToasts();
    expect(screen.getByText(HINT)).toBeInTheDocument();

    act(() => { toast.dismiss(id); });
    await settleToasts();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is invisible: a sighted user sees no extra text", async () => {
    render(<ThemedToaster />);
    act(() => { showUndoToast(); });
    await settleToasts();

    const hint = screen.getByText(HINT);
    expect(hint).toHaveClass("sr-only");
  });
});
