import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncSettings } from "@/components/settings/sync-settings";
import { disableSync, getSyncStatus } from "@/lib/sync/config";

vi.mock("@/lib/sync/config", () => ({
  getAutoSyncConfig: vi.fn().mockResolvedValue({ enabled: true, intervalMinutes: 2 }),
  updateAutoSyncConfig: vi.fn().mockResolvedValue(undefined),
  disableSync: vi.fn().mockResolvedValue(undefined),
  getSyncStatus: vi.fn(),
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

function renderSettings() {
  return render(
    <SyncSettings
      onViewHistory={vi.fn()}
      onExport={vi.fn().mockResolvedValue(true)}
      onAccountDeleted={vi.fn()}
    />,
  );
}

describe("SyncSettings sign out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSyncStatus).mockResolvedValue({
      enabled: true,
      email: "signed-in@example.com",
      lastSyncAt: null,
      pendingCount: 0,
      deviceId: "test-device",
    });
  });

  it("shows_the_signed_in_account_and_a_sign_out_button", async () => {
    renderSettings();

    expect(await screen.findByText("signed-in@example.com")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("signs_out_immediately_when_nothing_is_pending", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole("button", { name: /sign out/i }));

    expect(disableSync).toHaveBeenCalledOnce();
  });

  it("confirms_before_discarding_pending_changes", async () => {
    vi.mocked(getSyncStatus).mockResolvedValue({
      enabled: true,
      email: "signed-in@example.com",
      lastSyncAt: null,
      pendingCount: 3,
      deviceId: "test-device",
    });
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole("button", { name: /sign out/i }));

    // disableSync clears the sync queue, so unsynced work must not vanish on
    // a single click.
    expect(disableSync).not.toHaveBeenCalled();
    expect(screen.getByText(/3 unsynchronized changes/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /logout anyway/i }));

    expect(disableSync).toHaveBeenCalledOnce();
  });

  it("hides_sign_out_when_no_account_is_connected", async () => {
    vi.mocked(getSyncStatus).mockResolvedValue({
      enabled: false,
      email: null,
      lastSyncAt: null,
      pendingCount: 0,
      deviceId: null,
    });
    renderSettings();

    // The auto-sync row still renders, so wait on it before asserting absence.
    expect(await screen.findByText("Auto-sync")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
  });
});
