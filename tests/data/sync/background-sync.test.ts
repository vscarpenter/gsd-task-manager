/**
 * Tests for BackgroundSyncManager
 * Covers singleton, start/stop lifecycle, debounced sync, and periodic sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockRequestSync,
  mockGetPendingCount,
  mockSubscribe,
  mockUnsubscribe,
} = vi.hoisted(() => ({
  mockRequestSync: vi.fn().mockResolvedValue({ success: true }),
  mockGetPendingCount: vi.fn().mockResolvedValue(0),
  mockSubscribe: vi.fn().mockResolvedValue(undefined),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/sync/sync-coordinator", () => ({
  getSyncCoordinator: () => ({ requestSync: mockRequestSync }),
}));

vi.mock("@/lib/sync/queue", () => ({
  getSyncQueue: () => ({ getPendingCount: mockGetPendingCount }),
}));

vi.mock("@/lib/sync/pb-realtime", () => ({
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/constants/sync", () => ({
  SYNC_CONFIG: {
    INITIAL_SYNC_DELAY_MS: 100,
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  BackgroundSyncManager,
  getBackgroundSyncManager,
} from "@/lib/sync/background-sync";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BackgroundSyncManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Stub navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    // Stub document.hidden
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getBackgroundSyncManager returns a singleton", () => {
    const a = getBackgroundSyncManager();
    const b = getBackgroundSyncManager();

    expect(a).toBe(b);
    expect(a).toBeInstanceOf(BackgroundSyncManager);
  });

  it("isRunning returns false before start", () => {
    const manager = new BackgroundSyncManager();

    expect(manager.isRunning()).toBe(false);
  });

  it("start with enabled=false sets active but does not start periodic sync", async () => {
    const manager = new BackgroundSyncManager();

    await manager.start({ enabled: false, intervalMinutes: 1, syncOnFocus: false, syncOnOnline: false, debounceAfterChangeMs: 500 });

    expect(manager.isRunning()).toBe(true);

    // No periodic sync should fire
    vi.advanceTimersByTime(120_000);

    expect(mockRequestSync).not.toHaveBeenCalled();

    manager.stop();
  });

  it("stop clears running state and unsubscribes realtime", async () => {
    const manager = new BackgroundSyncManager();

    await manager.start({ enabled: true, intervalMinutes: 5, syncOnFocus: false, syncOnOnline: false, debounceAfterChangeMs: 500 }, "device-1");

    expect(manager.isRunning()).toBe(true);

    manager.stop();

    expect(manager.isRunning()).toBe(false);
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("stop is a no-op when not active", () => {
    const manager = new BackgroundSyncManager();

    // Should not throw
    manager.stop();

    expect(manager.isRunning()).toBe(false);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it("scheduleDebouncedSync is a no-op when not running", () => {
    const manager = new BackgroundSyncManager();

    // Should not throw
    manager.scheduleDebouncedSync();

    vi.advanceTimersByTime(10_000);

    expect(mockRequestSync).not.toHaveBeenCalled();
  });

  it("start sets up periodic sync that triggers requestSync", async () => {
    const manager = new BackgroundSyncManager();

    await manager.start({
      enabled: true,
      intervalMinutes: 1,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 500,
    });

    // Wait past initial sync delay
    await vi.advanceTimersByTimeAsync(200);

    // Initial sync fires
    expect(mockRequestSync).toHaveBeenCalledWith("auto");

    // Reset and wait for periodic sync (1 minute interval)
    mockRequestSync.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockRequestSync).toHaveBeenCalledWith("auto");

    manager.stop();
  });

  it("start subscribes to realtime when deviceId is provided", async () => {
    const manager = new BackgroundSyncManager();

    await manager.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 500,
    }, "my-device");

    expect(mockSubscribe).toHaveBeenCalledWith("my-device");

    manager.stop();
  });
});
