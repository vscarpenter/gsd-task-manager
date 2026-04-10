import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Common mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// 1. RetryManager — branch coverage
// ---------------------------------------------------------------------------

const mockGetSyncConfig = vi.fn();
const mockUpdateSyncConfig = vi.fn();

vi.mock("@/lib/sync/config", () => ({
  getSyncConfig: (...args: unknown[]) => mockGetSyncConfig(...args),
  updateSyncConfig: (...args: unknown[]) => mockUpdateSyncConfig(...args),
}));

describe("RetryManager", () => {
  let RetryManager: typeof import("@/lib/sync/retry-manager").RetryManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSyncConfig.mockResolvedValue(null);
    mockUpdateSyncConfig.mockResolvedValue(undefined);

    const mod = await import("@/lib/sync/retry-manager");
    RetryManager = mod.RetryManager;
  });

  describe("recordFailure", () => {
    it("does nothing when sync config is null", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue(null);

      await mgr.recordFailure(new Error("test error"));
      expect(mockUpdateSyncConfig).not.toHaveBeenCalled();
    });

    it("increments failure count and schedules retry", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({
        consecutiveFailures: 2,
      });

      await mgr.recordFailure(new Error("network fail"));

      expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveFailures: 3,
          lastFailureReason: "network fail",
        })
      );
    });
  });

  describe("recordSuccess", () => {
    it("does nothing when sync config is null", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue(null);

      await mgr.recordSuccess();
      expect(mockUpdateSyncConfig).not.toHaveBeenCalled();
    });

    it("resets failure counter when there were previous failures", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({ consecutiveFailures: 3 });

      await mgr.recordSuccess();

      expect(mockUpdateSyncConfig).toHaveBeenCalledWith({
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
      });
    });

    it("skips update when no previous failures", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({ consecutiveFailures: 0 });

      await mgr.recordSuccess();
      expect(mockUpdateSyncConfig).not.toHaveBeenCalled();
    });
  });

  describe("getNextRetryDelay", () => {
    it("returns first delay when failureCount is 0 or undefined", () => {
      const mgr = new RetryManager();
      // When called with no arg, failures defaults to 0 and index = -1 -> returns RETRY_DELAYS[0]
      expect(mgr.getNextRetryDelay()).toBe(5000);
    });

    it("returns correct delay for failure count 1", () => {
      const mgr = new RetryManager();
      expect(mgr.getNextRetryDelay(1)).toBe(5000);
    });

    it("returns correct delay for failure count 2", () => {
      const mgr = new RetryManager();
      expect(mgr.getNextRetryDelay(2)).toBe(10000);
    });

    it("caps delay at max for high failure counts", () => {
      const mgr = new RetryManager();
      // RETRY_DELAYS has 5 entries, so failure 100 should cap at the last one (300000)
      expect(mgr.getNextRetryDelay(100)).toBe(300000);
    });
  });

  describe("shouldRetry", () => {
    it("returns false when config is null", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue(null);

      expect(await mgr.shouldRetry()).toBe(false);
    });

    it("returns true when below max retries", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({ consecutiveFailures: 2 });

      expect(await mgr.shouldRetry()).toBe(true);
    });

    it("returns false when at max retries", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({ consecutiveFailures: 5 });

      expect(await mgr.shouldRetry()).toBe(false);
    });
  });

  describe("getRetryCount", () => {
    it("returns 0 when config is null", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue(null);

      expect(await mgr.getRetryCount()).toBe(0);
    });

    it("returns consecutive failures count", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({ consecutiveFailures: 4 });

      expect(await mgr.getRetryCount()).toBe(4);
    });
  });

  describe("canSyncNow", () => {
    it("returns false when config is null", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue(null);

      expect(await mgr.canSyncNow()).toBe(false);
    });

    it("returns true when no retry scheduled", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({ nextRetryAt: null });

      expect(await mgr.canSyncNow()).toBe(true);
    });

    it("returns true when retry time has passed", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({
        nextRetryAt: Date.now() - 10000,
      });

      expect(await mgr.canSyncNow()).toBe(true);
    });

    it("returns false when retry time is in the future", async () => {
      const mgr = new RetryManager();
      mockGetSyncConfig.mockResolvedValue({
        nextRetryAt: Date.now() + 60000,
      });

      expect(await mgr.canSyncNow()).toBe(false);
    });
  });

  describe("getRetryManager singleton", () => {
    it("returns the same instance on subsequent calls", async () => {
      // Re-import to get a fresh module with cleared singleton state
      vi.resetModules();
      const mod = await import("@/lib/sync/retry-manager");

      const a = mod.getRetryManager();
      const b = mod.getRetryManager();
      expect(a).toBe(b);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. useSyncStatus — formatRelativeTime branches
// ---------------------------------------------------------------------------

const mockUseSync = vi.fn();

vi.mock("@/lib/hooks/use-sync", () => ({
  useSync: () => mockUseSync(),
}));

vi.mock("@/lib/sync/queue", () => ({
  getSyncQueue: () => ({
    getPendingCount: vi.fn().mockResolvedValue(0),
  }),
}));

vi.mock("@/lib/sync/sync-coordinator", () => ({
  getSyncCoordinator: () => ({
    getStatus: vi.fn().mockResolvedValue({
      lastSuccessfulSyncAt: null,
    }),
  }),
}));

describe("useSyncStatus — formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseSync.mockReturnValue({
      isEnabled: false,
      nextRetryAt: null,
      retryCount: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the formatRelativeTime helper from the hook", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const fmt = result.current.formatRelativeTime;
    expect(typeof fmt).toBe("function");
  });

  it("formatRelativeTime returns 'Never' for null", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.formatRelativeTime(null)).toBe("Never");
  });

  it("formatRelativeTime returns 'Just now' for recent timestamp", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const now = new Date().toISOString();
    expect(result.current.formatRelativeTime(now)).toBe("Just now");
  });

  it("formatRelativeTime returns '1 minute ago' for singular", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    expect(result.current.formatRelativeTime(oneMinAgo)).toBe("1 minute ago");
  });

  it("formatRelativeTime returns '5 minutes ago' for plural", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(result.current.formatRelativeTime(fiveMinAgo)).toBe(
      "5 minutes ago"
    );
  });

  it("formatRelativeTime returns '1 hour ago' for singular hour", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(result.current.formatRelativeTime(oneHourAgo)).toBe("1 hour ago");
  });

  it("formatRelativeTime returns '3 hours ago' for plural hours", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000
    ).toISOString();
    expect(result.current.formatRelativeTime(threeHoursAgo)).toBe(
      "3 hours ago"
    );
  });

  it("formatRelativeTime returns '1 day ago' for singular day", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
    expect(result.current.formatRelativeTime(oneDayAgo)).toBe("1 day ago");
  });

  it("formatRelativeTime returns '7 days ago' for plural days", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(result.current.formatRelativeTime(sevenDaysAgo)).toBe(
      "7 days ago"
    );
  });

  it("hook returns isEnabled false when sync is not enabled", async () => {
    const { useSyncStatus } = await import("@/lib/hooks/use-sync-status");
    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.lastSyncTime).toBeNull();
  });
});
