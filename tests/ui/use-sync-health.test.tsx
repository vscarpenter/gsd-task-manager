import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { SYNC_CONFIG, SYNC_TOAST_DURATION } from "@/lib/constants/sync";
import type { HealthIssue, HealthReport } from "@/lib/sync/health-monitor";

const mockCheck = vi.fn<() => Promise<HealthReport>>();

vi.mock("@/lib/sync/health-monitor", () => ({
  getHealthMonitor: () => ({ check: mockCheck }),
}));

import { useSyncHealth } from "@/components/sync/use-sync-health";

const staleQueueIssue: HealthIssue = {
  type: "stale_queue",
  severity: "warning",
  message: "1 pending operations are older than 1 hour",
  suggestedAction: "Try syncing manually to clear pending operations",
};

const failedItemsIssue: HealthIssue = {
  type: "failed_items",
  severity: "error",
  message: "2 sync operations have failed and need attention",
  suggestedAction:
    "Review failed items in sync history. They will not retry automatically until cleared.",
};

function unhealthy(issues: HealthIssue[]): HealthReport {
  return { healthy: false, issues, timestamp: 0 };
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useSyncHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCheck.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a stale-queue warning with a stable id and a Sync Now action", async () => {
    mockCheck.mockResolvedValue(unhealthy([staleQueueIssue]));
    const onHealthIssue = vi.fn();

    renderHook(() =>
      useSyncHealth({ isEnabled: true, onHealthIssue, onSync: vi.fn() }),
    );
    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    expect(onHealthIssue).toHaveBeenCalledTimes(1);
    expect(onHealthIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sync-health-stale_queue",
        message: "1 pending operations are older than 1 hour",
        duration: SYNC_TOAST_DURATION.LONG,
        action: expect.objectContaining({ label: "Sync Now" }),
      }),
    );
  });

  it("wires the Sync Now action to onSync", async () => {
    mockCheck.mockResolvedValue(unhealthy([staleQueueIssue]));
    const onHealthIssue = vi.fn();
    const onSync = vi.fn();

    renderHook(() => useSyncHealth({ isEnabled: true, onHealthIssue, onSync }));
    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    const notification = onHealthIssue.mock.calls[0][0];
    notification.action.onClick();
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("shows an error issue with a stable id and no action", async () => {
    mockCheck.mockResolvedValue(unhealthy([failedItemsIssue]));
    const onHealthIssue = vi.fn();

    renderHook(() =>
      useSyncHealth({ isEnabled: true, onHealthIssue, onSync: vi.fn() }),
    );
    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    expect(onHealthIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sync-health-failed_items",
        message: `${failedItemsIssue.message}. ${failedItemsIssue.suggestedAction}`,
        duration: SYNC_TOAST_DURATION.LONG,
      }),
    );
    expect(onHealthIssue.mock.calls[0][0].action).toBeUndefined();
  });

  it("does not notify again within the cooldown window", async () => {
    mockCheck.mockResolvedValue(unhealthy([staleQueueIssue]));
    const onHealthIssue = vi.fn();

    renderHook(() =>
      useSyncHealth({ isEnabled: true, onHealthIssue, onSync: vi.fn() }),
    );

    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);
    expect(onHealthIssue).toHaveBeenCalledTimes(1);

    // The periodic check fires again but is gated by the cooldown.
    await advance(
      SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS -
        SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS,
    );
    expect(onHealthIssue).toHaveBeenCalledTimes(1);
  });

  it("keeps the cooldown when callbacks change identity between renders", async () => {
    mockCheck.mockResolvedValue(unhealthy([staleQueueIssue]));
    const onHealthIssue = vi.fn();

    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useSyncHealth({ isEnabled: true, onHealthIssue, onSync: cb }),
      { initialProps: { cb: () => {} } },
    );

    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);
    expect(onHealthIssue).toHaveBeenCalledTimes(1);

    // A status-poll re-render hands the hook fresh callback identities. This
    // must not re-arm the timers and replay the notification.
    rerender({ cb: () => {} });
    rerender({ cb: () => {} });

    await advance(
      SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS -
        SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS,
    );
    expect(onHealthIssue).toHaveBeenCalledTimes(1);
  });

  it("ignores warnings that are not a stale queue", async () => {
    mockCheck.mockResolvedValue(
      unhealthy([{ ...staleQueueIssue, type: "server_unreachable" }]),
    );
    const onHealthIssue = vi.fn();

    renderHook(() =>
      useSyncHealth({ isEnabled: true, onHealthIssue, onSync: vi.fn() }),
    );
    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    expect(onHealthIssue).not.toHaveBeenCalled();
  });

  it("does not check health when sync is disabled", async () => {
    mockCheck.mockResolvedValue(unhealthy([staleQueueIssue]));
    const onHealthIssue = vi.fn();

    renderHook(() =>
      useSyncHealth({ isEnabled: false, onHealthIssue, onSync: vi.fn() }),
    );
    await advance(SYNC_CONFIG.INITIAL_HEALTH_CHECK_DELAY_MS);

    expect(mockCheck).not.toHaveBeenCalled();
    expect(onHealthIssue).not.toHaveBeenCalled();
  });
});
