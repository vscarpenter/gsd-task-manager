import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAutoArchive } from "@/lib/use-auto-archive";
import * as archive from "@/lib/archive";

vi.mock("@/lib/archive", () => ({
  getArchiveSettings: vi.fn(),
  archiveOldTasks: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("useAutoArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    vi.useRealTimers();
    setIntervalSpy.mockRestore();
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

    vi.useRealTimers();
    clearIntervalSpy.mockRestore();
  });
});
