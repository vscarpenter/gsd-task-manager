import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/sync/sync-button", () => ({
  SyncButton: () => <button type="button">Sync</button>,
}));

import { SimplifiedTopbar } from "@/components/matrix-simplified/topbar";

vi.mock("@/lib/hooks/use-sync-status", () => ({
  useSyncStatus: () => ({
    isEnabled: true,
    lastSyncTime: null,
    retryCountdown: null,
    retryCount: 0,
    pendingCount: 0,
    error: null,
    formatRelativeTime: () => "Never",
  }),
}));

vi.mock("@/lib/use-scroll-chrome", () => ({
  useScrollChrome: () => false,
}));

describe("SimplifiedTopbar", () => {
  it("keeps search and sync in the document below the desktop breakpoint", () => {
    render(
      <SimplifiedTopbar
        title="Matrix"
        searchQuery=""
        onSearchChange={() => undefined}
      />
    );

    expect(screen.getByTestId("topbar-search")).not.toHaveClass("hidden");
    expect(screen.getByTestId("topbar-search")).toHaveClass("w-full");
    expect(screen.getByTestId("topbar-sync")).not.toHaveClass("hidden");
    expect(screen.getByLabelText("Search tasks")).toBeInTheDocument();
  });

  // jsdom has no layout; tests/e2e/layout-fit.spec.ts measures the rows.
  it("lets search give up width before the controls beside it wrap", () => {
    render(<SimplifiedTopbar title="Matrix" searchQuery="" onSearchChange={() => undefined} />);

    const search = screen.getByTestId("topbar-search");
    expect(search).toHaveClass("sm:flex-[1_1_12rem]", "sm:max-w-72");
    expect(search).not.toHaveClass("sm:w-72");
  });

  it("keeps sync and the right slot together, so neither wraps onto a row alone", () => {
    render(
      <SimplifiedTopbar
        title="Matrix"
        rightSlot={<button type="button">Open command palette</button>}
      />
    );

    const actions = screen.getByTestId("topbar-actions");
    expect(actions).toContainElement(screen.getByTestId("topbar-sync"));
    expect(actions).toContainElement(screen.getByRole("button", { name: "Open command palette" }));
  });

  // The bar wraps as text grows (252px on a phone at 150%), so the scroll
  // margins that keep focus clear of it read its measured height.
  it("publishes its height for the scroll margins and withdraws it on unmount", () => {
    vi.stubGlobal("ResizeObserver", class {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(): void {
        this.callback([], this as unknown as ResizeObserver);
      }
      unobserve(): void {}
      disconnect(): void {}
    });
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(123);
    const root = document.documentElement.style;

    const { unmount } = render(<SimplifiedTopbar title="Matrix" />);
    expect(root.getPropertyValue("--topbar-height")).toBe("123px");

    unmount();
    expect(root.getPropertyValue("--topbar-height")).toBe("");
    height.mockRestore();
    vi.unstubAllGlobals();
  });
});
