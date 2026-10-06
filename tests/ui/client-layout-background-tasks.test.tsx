import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { TIME_MS } from "@/lib/constants";

/**
 * Reminders and the trash and archive sweep belong to the whole app, not to
 * the matrix view, so they keep running on the dashboard, settings, and every
 * other route. Each has exactly one owner, so neither runs twice per interval.
 */

const checker = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));

vi.mock("@/lib/notification-checker", () => ({ notificationChecker: checker }));

vi.mock("@/lib/trash", () => ({ purgeExpiredTrash: vi.fn().mockResolvedValue(0) }));

vi.mock("@/lib/archive", () => ({
  getArchiveSettings: vi.fn().mockResolvedValue({ id: "settings", enabled: true, archiveAfterDays: 30 }),
  archiveOldTasks: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/sync/sync-provider", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ClientLayout } from "@/components/client-layout";
import { purgeExpiredTrash } from "@/lib/trash";
import { archiveOldTasks } from "@/lib/archive";

async function flushEffects() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("ClientLayout background tasks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the reminder checker once for any route and stops it on unmount", () => {
    const { unmount } = render(
      <ClientLayout>
        <p>dashboard</p>
      </ClientLayout>
    );

    expect(checker.start).toHaveBeenCalledTimes(1);

    unmount();

    expect(checker.stop).toHaveBeenCalledTimes(1);
  });

  it("runs the trash and archive sweep once on mount and once per hour", async () => {
    render(
      <ClientLayout>
        <p>settings</p>
      </ClientLayout>
    );
    await flushEffects();

    expect(purgeExpiredTrash).toHaveBeenCalledTimes(1);
    expect(archiveOldTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIME_MS.HOUR);
    });

    expect(purgeExpiredTrash).toHaveBeenCalledTimes(2);
    expect(archiveOldTasks).toHaveBeenCalledTimes(2);
  });
});
