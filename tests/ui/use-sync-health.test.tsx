import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { SYNC_CONFIG, SYNC_TOAST_DURATION } from "@/lib/constants/sync";
import type { HealthIssue, HealthReport } from "@/lib/sync/health-monitor";
import { useSyncHealth } from "@/components/sync/use-sync-health";

// The hook used to run its own health check on a timer. The sync status store
// runs the check now and publishes each report; the hook turns a report into
// toasts, once per report, with the same cooldown and stable ids as before.

const NOW = new Date("2026-10-08T12:00:00.000Z").getTime();

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

function unhealthy(issues: HealthIssue[], timestamp = NOW): HealthReport {
  return { healthy: false, issues, timestamp };
}

type HookProps = {
  healthReport: HealthReport | null;
  onHealthIssue: (notification: { id: string }) => void;
  onSync: () => void;
};

function renderSyncHealth(initialProps: HookProps) {
  return renderHook((props: HookProps) => useSyncHealth(props), { initialProps });
}

describe("useSyncHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a stale-queue warning with a stable id and a Sync Now action", () => {
    const onHealthIssue = vi.fn();

    renderSyncHealth({ healthReport: unhealthy([staleQueueIssue]), onHealthIssue, onSync: vi.fn() });

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

  it("wires the Sync Now action to onSync", () => {
    const onHealthIssue = vi.fn();
    const onSync = vi.fn();

    renderSyncHealth({ healthReport: unhealthy([staleQueueIssue]), onHealthIssue, onSync });

    const notification = onHealthIssue.mock.calls[0][0];
    notification.action.onClick();
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("shows an error issue with a stable id and no action", () => {
    const onHealthIssue = vi.fn();

    renderSyncHealth({ healthReport: unhealthy([failedItemsIssue]), onHealthIssue, onSync: vi.fn() });

    expect(onHealthIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sync-health-failed_items",
        message: `${failedItemsIssue.message}. ${failedItemsIssue.suggestedAction}`,
        duration: SYNC_TOAST_DURATION.LONG,
      }),
    );
    expect(onHealthIssue.mock.calls[0][0].action).toBeUndefined();
  });

  it("notifies once per report, not once per render", () => {
    const onHealthIssue = vi.fn();
    const report = unhealthy([staleQueueIssue]);

    const { rerender } = renderSyncHealth({ healthReport: report, onHealthIssue, onSync: vi.fn() });
    rerender({ healthReport: report, onHealthIssue, onSync: vi.fn() });
    rerender({ healthReport: report, onHealthIssue, onSync: vi.fn() });

    expect(onHealthIssue).toHaveBeenCalledTimes(1);
  });

  it("does not notify again for a report inside the cooldown window", () => {
    const onHealthIssue = vi.fn();
    const onSync = vi.fn();

    const { rerender } = renderSyncHealth({
      healthReport: unhealthy([staleQueueIssue]),
      onHealthIssue,
      onSync,
    });
    expect(onHealthIssue).toHaveBeenCalledTimes(1);

    // The next check lands 5 min after enable, 4 min 50 s after this one.
    vi.setSystemTime(NOW + SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS - 10_000);
    rerender({ healthReport: unhealthy([staleQueueIssue], NOW + 290_000), onHealthIssue, onSync });
    expect(onHealthIssue).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW + SYNC_CONFIG.NOTIFICATION_COOLDOWN_MS);
    rerender({ healthReport: unhealthy([staleQueueIssue], NOW + 300_000), onHealthIssue, onSync });
    expect(onHealthIssue).toHaveBeenCalledTimes(2);
  });

  it("keeps the cooldown when callbacks change identity between renders", () => {
    const onHealthIssue = vi.fn();
    const report = unhealthy([staleQueueIssue]);

    const { rerender } = renderSyncHealth({ healthReport: report, onHealthIssue, onSync: () => {} });
    expect(onHealthIssue).toHaveBeenCalledTimes(1);

    // A status-poll re-render hands the hook fresh callback identities. This
    // must not replay the notification, with or without a fresh report.
    rerender({ healthReport: report, onHealthIssue, onSync: () => {} });
    vi.setSystemTime(NOW + 60_000);
    rerender({ healthReport: unhealthy([staleQueueIssue], NOW + 60_000), onHealthIssue, onSync: () => {} });

    expect(onHealthIssue).toHaveBeenCalledTimes(1);
  });

  it("ignores warnings that are not a stale queue", () => {
    const onHealthIssue = vi.fn();

    renderSyncHealth({
      healthReport: unhealthy([{ ...staleQueueIssue, type: "server_unreachable" }]),
      onHealthIssue,
      onSync: vi.fn(),
    });

    expect(onHealthIssue).not.toHaveBeenCalled();
  });

  it("does nothing without a report or with a healthy one", () => {
    const onHealthIssue = vi.fn();

    const { rerender } = renderSyncHealth({ healthReport: null, onHealthIssue, onSync: vi.fn() });
    rerender({ healthReport: { healthy: true, issues: [], timestamp: NOW }, onHealthIssue, onSync: vi.fn() });

    expect(onHealthIssue).not.toHaveBeenCalled();
  });
});
