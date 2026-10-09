import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/sync/sync-button", () => ({
  SyncButton: () => <button type="button">Sync</button>,
}));

import { SyncStatusDisplay } from "@/components/matrix-simplified/sync-status-display";

const base = {
  isEnabled: true,
  lastSyncTime: "2026-10-09T12:00:00.000Z",
  retryCountdown: null,
  retryCount: 0,
  pendingCount: 0,
  formatRelativeTime: () => "1 minute ago",
};

describe("SyncStatusDisplay", () => {
  it("says all synced when the queue is empty and the last attempt worked", () => {
    render(<SyncStatusDisplay {...base} error={null} />);
    expect(screen.getByText("All synced")).toBeInTheDocument();
  });

  it("says the last sync failed while an error is still set", () => {
    render(<SyncStatusDisplay {...base} error="network_error" />);
    expect(screen.getByText("Last sync failed")).toBeInTheDocument();
    expect(screen.queryByText("All synced")).not.toBeInTheDocument();
  });
});
