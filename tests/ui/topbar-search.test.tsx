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
});
