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

  // Migrated from the former tests/data/sync-and-utils-boost.test.ts
  // "BackgroundSyncManager" block (finding F2.1). Only the cases that covered
  // branches not already exercised above were kept; the debounce case was
  // rewritten to assert the sync actually fires (the original asserted nothing).

  it("start with syncOnFocus registers a visibilitychange listener", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const manager = new BackgroundSyncManager();

    await manager.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: true,
      syncOnOnline: false,
      debounceAfterChangeMs: 500,
    });

    expect(addSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    manager.stop();
    addSpy.mockRestore();
  });

  it("start with syncOnOnline registers an online listener", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const manager = new BackgroundSyncManager();

    await manager.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: true,
      debounceAfterChangeMs: 500,
    });

    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));

    manager.stop();
    addSpy.mockRestore();
  });

  it("scheduleDebouncedSync triggers one sync after the debounce window when running", async () => {
    const manager = new BackgroundSyncManager();

    // enabled:false starts the manager (active, config set) without an initial
    // or periodic sync, so the debounced sync is the first one and is not
    // suppressed by the min-interval "too soon since last sync" guard.
    await manager.start({
      enabled: false,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 500,
    });

    manager.scheduleDebouncedSync();
    // A second call within the window resets the timer rather than double-firing.
    manager.scheduleDebouncedSync();

    await vi.advanceTimersByTimeAsync(500);

    expect(mockRequestSync).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it("start stops a previous run before starting again", async () => {
    const manager = new BackgroundSyncManager();
    const config = {
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 500,
    };

    await manager.start(config);
    await manager.start(config); // should stop the previous run first

    expect(manager.isRunning()).toBe(true);

    manager.stop();
  });
});
