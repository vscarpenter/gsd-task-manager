import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAutoArchive } from "@/lib/use-auto-archive";
import * as archive from "@/lib/archive";
import { isSyncEnabled } from "@/lib/sync/config";
import { purgeExpiredTrash } from "@/lib/trash";
import { TIME_MS } from "@/lib/constants";

vi.mock("@/lib/archive", () => ({
  getArchiveSettings: vi.fn(),
  archiveOldTasks: vi.fn(),
}));

vi.mock("@/lib/trash", () => ({ purgeExpiredTrash: vi.fn().mockResolvedValue(0) }));

vi.mock("@/lib/sync/config", () => ({ isSyncEnabled: vi.fn() }));

// The hook hangs the post-pull archive off the coordinator. Capture the
// listener so a test can play "a pull just completed".
const pulls = vi.hoisted(() => ({
  listener: null as null | (() => void | Promise<void>),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/sync/sync-coordinator", () => ({
  getSyncCoordinator: () => ({
    onPulled: (listener: () => void | Promise<void>) => {
      pulls.listener = listener;
      return pulls.unsubscribe;
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

async function pullCompletes(): Promise<void> {
  await pulls.listener?.();
}

describe("useAutoArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pulls.listener = null;
    vi.mocked(isSyncEnabled).mockResolvedValue(false);
  });

  it("runs auto-archive check on mount when enabled", async () => {
    vi.mocked(archive.getArchiveSettings).mockResolvedValue({
      id: "settings",
      enabled: true,
      archiveAfterDays: 30,
    });
    vi.mocked(archive.archiveOldTasks).mockResolvedValue(0);

    renderHook(() => useAutoArchive());

    await waitFor(() => {
      expect(archive.getArchiveSettings).toHaveBeenCalled();
    });

    expect(archive.archiveOldTasks).toHaveBeenCalledWith(30);
  });

  it("does not archive when disabled", async () => {
    vi.mocked(archive.getArchiveSettings).mockResolvedValue({
      id: "settings",
      enabled: false,
      archiveAfterDays: 30,
    });
    vi.mocked(archive.archiveOldTasks).mockResolvedValue(0);

    renderHook(() => useAutoArchive());

    await waitFor(() => {
      expect(archive.getArchiveSettings).toHaveBeenCalled();
    });

    expect(archive.archiveOldTasks).not.toHaveBeenCalled();
  });

  it("uses configured archive interval from settings", async () => {
    vi.mocked(archive.getArchiveSettings).mockResolvedValue({
      id: "settings",
      enabled: true,
      archiveAfterDays: 60,
    });
    vi.mocked(archive.archiveOldTasks).mockResolvedValue(5);

    renderHook(() => useAutoArchive());

    await waitFor(() => {
      expect(archive.archiveOldTasks).toHaveBeenCalledWith(60);
    });
  });

  it("handles errors gracefully", async () => {
    vi.mocked(archive.getArchiveSettings).mockRejectedValue(
      new Error("Database error")
    );

    renderHook(() => useAutoArchive());

    await waitFor(() => {
      expect(archive.getArchiveSettings).toHaveBeenCalled();
    });

    // Should not throw, error is caught internally
    expect(archive.archiveOldTasks).not.toHaveBeenCalled();
  });

  it("sets up interval for periodic checks", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    vi.mocked(archive.getArchiveSettings).mockResolvedValue({
      id: "settings",
      enabled: true,
      archiveAfterDays: 30,
    });
    vi.mocked(archive.archiveOldTasks).mockResolvedValue(0);

    renderHook(() => useAutoArchive());

    // Verify interval is set up with 1 hour (3600000ms)
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      60 * 60 * 1000
    );

    // Restore the spy before the clock: the other order puts the fake
    // setInterval back on global, and later waitFor calls never poll.
    setIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("cleans up interval on unmount", () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    vi.mocked(archive.getArchiveSettings).mockResolvedValue({
      id: "settings",
      enabled: true,
      archiveAfterDays: 30,
    });
    vi.mocked(archive.archiveOldTasks).mockResolvedValue(0);

    const { unmount } = renderHook(() => useAutoArchive());

    unmount();

    // Verify interval is cleaned up
    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  // Archiving deletes each task's server copy. With sync on, a sweep from a
  // stale local copy (page load before the first pull, or a tab that sat in the
  // background) would archive a task someone reopened on another device, and
  // its delete would remove that task everywhere (parity backlog B-46).
  describe("with sync on", () => {
    beforeEach(() => {
      vi.mocked(isSyncEnabled).mockResolvedValue(true);
      vi.mocked(archive.getArchiveSettings).mockResolvedValue({
        id: "settings",
        enabled: true,
        archiveAfterDays: 30,
      });
      vi.mocked(archive.archiveOldTasks).mockResolvedValue(0);
    });

    /**
     * Mount, and let the on-mount check run to the end. Every mock resolves in
     * a microtask, so one macrotask tick drains the whole chain.
     */
    async function mountAndSettle() {
      const hook = renderHook(() => useAutoArchive());
      await new Promise((resolve) => setTimeout(resolve, 0));
      return hook;
    }

    it("does not archive on mount, before any pull", async () => {
      await mountAndSettle();

      expect(archive.archiveOldTasks).not.toHaveBeenCalled();
    });

    it("archives once a pull completes", async () => {
      await mountAndSettle();
      expect(archive.archiveOldTasks).not.toHaveBeenCalled();

      await pullCompletes();

      expect(archive.archiveOldTasks).toHaveBeenCalledWith(30);
    });

    it("archives at most once an hour however often it pulls", async () => {
      await mountAndSettle();
      expect(pulls.listener).not.toBeNull();

      await pullCompletes();
      await pullCompletes();

      expect(archive.archiveOldTasks).toHaveBeenCalledTimes(1);
    });

    it("archives on a later pull if auto-archive was off at the first", async () => {
      vi.mocked(archive.getArchiveSettings).mockResolvedValueOnce({
        id: "settings",
        enabled: false,
        archiveAfterDays: 30,
      });
      await mountAndSettle();

      await pullCompletes();
      await pullCompletes();

      expect(archive.archiveOldTasks).toHaveBeenCalledTimes(1);
    });

    it("archives again on the first pull an hour later", async () => {
      const start = 1_000_000;
      const now = vi.spyOn(Date, "now").mockReturnValue(start);
      try {
        await mountAndSettle();
        await pullCompletes();

        now.mockReturnValue(start + TIME_MS.HOUR);
        await pullCompletes();

        expect(archive.archiveOldTasks).toHaveBeenCalledTimes(2);
      } finally {
        now.mockRestore();
      }
    });

    it("does not archive on the hourly check, only after a pull", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      try {
        await mountAndSettle();

        await vi.advanceTimersByTimeAsync(TIME_MS.HOUR);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(purgeExpiredTrash).toHaveBeenCalledTimes(2);
        expect(archive.archiveOldTasks).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("treats an unreadable sync state as on, and waits for a pull", async () => {
      vi.mocked(isSyncEnabled).mockRejectedValue(new Error("database closed"));

      await mountAndSettle();

      expect(archive.archiveOldTasks).not.toHaveBeenCalled();
    });

    it("still purges expired trash on mount, since trash never syncs", async () => {
      renderHook(() => useAutoArchive());

      await waitFor(() => expect(purgeExpiredTrash).toHaveBeenCalledTimes(1));
    });

    it("stops listening for pulls on unmount", () => {
      const { unmount } = renderHook(() => useAutoArchive());

      unmount();

      expect(pulls.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
