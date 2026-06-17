import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncSettings } from "@/components/settings/sync-settings";

vi.mock("@/lib/sync/config", () => ({
  getAutoSyncConfig: vi.fn().mockResolvedValue({ enabled: true, intervalMinutes: 2 }),
  updateAutoSyncConfig: vi.fn().mockResolvedValue(undefined),
  disableSync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/pb-account-deletion", () => ({
  deleteRemoteAccountAndTasks: vi.fn(),
}));

vi.mock("@/lib/reset-everything", () => ({
  resetEverything: vi.fn(),
  reloadAfterReset: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe("SyncSettings danger zone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens_delete_account_dialog_from_danger_zone", async () => {
    const user = userEvent.setup();
    render(
      <SyncSettings
        onViewHistory={vi.fn()}
        onExport={vi.fn().mockResolvedValue(true)}
        onAccountDeleted={vi.fn()}
      />,
    );

    const trigger = await screen.findByRole("button", { name: /delete account/i });
    await user.click(trigger);

    expect(
      screen.getByRole("heading", { name: /delete account/i }),
    ).toBeInTheDocument();
  });
});
