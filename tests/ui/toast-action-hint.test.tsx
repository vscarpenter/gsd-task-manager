import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { ThemedToaster } from "@/components/ui/themed-toaster";

const HINT = "Press Alt+T, then Tab twice, to reach Undo.";

function showUndoToast(): string | number {
  return toast.success("Task completed", { duration: Infinity, action: { label: "Undo", onClick: () => {} } });
}

describe("toast action keyboard hint", () => {
  afterEach(() => act(() => { toast.dismiss(); }));

  it("tells a screen reader how to reach the action when a toast carries one", async () => {
    render(<ThemedToaster />);
    act(() => { showUndoToast(); });

    const hint = await screen.findByText(HINT);
    expect(hint.closest("[role='status']")).toHaveAttribute("aria-live", "polite");
  });

  it("stays silent for a toast with no action", () => {
    render(<ThemedToaster />);
    act(() => { toast.success("Task duplicated", { duration: Infinity }); });

    expect(screen.queryByText(/Alt\+T/)).not.toBeInTheDocument();
  });

  it("clears the hint once the action toast is gone, so the next one is announced again", async () => {
    render(<ThemedToaster />);
    let id: string | number = "";
    act(() => { id = showUndoToast(); });
    await screen.findByText(HINT);

    act(() => { toast.dismiss(id); });
    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
  });

  it("is invisible: a sighted user sees no extra text", async () => {
    render(<ThemedToaster />);
    act(() => { showUndoToast(); });

    const hint = await screen.findByText(HINT);
    expect(hint).toHaveClass("sr-only");
  });
});
