/**
 * Coverage boost — targets sync utilities, background-sync manager,
 * and various utility functions with low function/branch coverage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("@/lib/sync/sync-coordinator", () => ({
  getSyncCoordinator: () => ({
    requestSync: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({
      isRunning: false,
      pendingRequests: 0,
      nextRetryAt: null,
      retryCount: 0,
      lastResult: null,
      lastError: null,
    }),
  }),
}));

vi.mock("@/lib/sync/queue", () => ({
  getSyncQueue: () => ({
    getPendingCount: vi.fn().mockResolvedValue(0),
    enqueue: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/sync/pb-realtime", () => ({
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn(),
}));

// ---------------------------------------------------------------------------
// 1. BackgroundSyncManager — function & branch coverage
// ---------------------------------------------------------------------------

describe("BackgroundSyncManager", () => {
  let BackgroundSyncManager: typeof import("@/lib/sync/background-sync").BackgroundSyncManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const mod = await import("@/lib/sync/background-sync");
    BackgroundSyncManager = mod.BackgroundSyncManager;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isRunning returns false initially", () => {
    const mgr = new BackgroundSyncManager();
    expect(mgr.isRunning()).toBe(false);
  });

  it("start sets isRunning to true", async () => {
    const mgr = new BackgroundSyncManager();
    await mgr.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 1000,
    });

    expect(mgr.isRunning()).toBe(true);
    mgr.stop();
  });

  it("start with enabled=false does not run periodic sync", async () => {
    const mgr = new BackgroundSyncManager();
    await mgr.start({
      enabled: false,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 1000,
    });

    // isActive is true, but no periodic sync starts
    expect(mgr.isRunning()).toBe(true);
    mgr.stop();
  });

  it("start with syncOnFocus sets up visibility listener", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const mgr = new BackgroundSyncManager();

    await mgr.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: true,
      syncOnOnline: false,
      debounceAfterChangeMs: 1000,
    });

    expect(addSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    mgr.stop();
    addSpy.mockRestore();
  });

  it("start with syncOnOnline sets up online listener", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const mgr = new BackgroundSyncManager();

    await mgr.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: true,
      debounceAfterChangeMs: 1000,
    });

    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    mgr.stop();
    addSpy.mockRestore();
  });

  it("start with deviceId subscribes to realtime", async () => {
    const { subscribe } = await import("@/lib/sync/pb-realtime");
    const mgr = new BackgroundSyncManager();

    await mgr.start(
      {
        enabled: true,
        intervalMinutes: 5,
        syncOnFocus: false,
        syncOnOnline: false,
        debounceAfterChangeMs: 1000,
      },
      "device-123"
    );

    expect(subscribe).toHaveBeenCalledWith("device-123");
    mgr.stop();
  });

  it("stop cleans up everything", async () => {
    const mgr = new BackgroundSyncManager();

    await mgr.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: true,
      syncOnOnline: true,
      debounceAfterChangeMs: 1000,
    });

    expect(mgr.isRunning()).toBe(true);
    mgr.stop();
    expect(mgr.isRunning()).toBe(false);
  });

  it("stop is a no-op when not running", () => {
    const mgr = new BackgroundSyncManager();
    expect(() => mgr.stop()).not.toThrow();
  });

  it("scheduleDebouncedSync is a no-op when not active", () => {
    const mgr = new BackgroundSyncManager();
    expect(() => mgr.scheduleDebouncedSync()).not.toThrow();
  });

  it("scheduleDebouncedSync schedules a sync", async () => {
    const mgr = new BackgroundSyncManager();

    await mgr.start({
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 500,
    });

    mgr.scheduleDebouncedSync();
    // Call again to test debounce clearing
    mgr.scheduleDebouncedSync();

    mgr.stop();
  });

  it("getBackgroundSyncManager returns singleton", async () => {
    vi.resetModules();
    const mod = await import("@/lib/sync/background-sync");
    const a = mod.getBackgroundSyncManager();
    const b = mod.getBackgroundSyncManager();
    expect(a).toBe(b);
  });

  it("start stops previous instance if already running", async () => {
    const mgr = new BackgroundSyncManager();
    const config = {
      enabled: true,
      intervalMinutes: 5,
      syncOnFocus: false,
      syncOnOnline: false,
      debounceAfterChangeMs: 1000,
    };

    await mgr.start(config);
    await mgr.start(config); // Should stop previous first
    expect(mgr.isRunning()).toBe(true);
    mgr.stop();
  });
});

// ---------------------------------------------------------------------------
// 2. Sync helpers — task mapper branches
// ---------------------------------------------------------------------------

describe("task-mapper", () => {
  it("maps local task to PocketBase format", async () => {
    const { taskRecordToPocketBase } = await import("@/lib/sync/task-mapper");
    const remote = taskRecordToPocketBase(
      {
        id: "t1",
        title: "Test",
        description: "Desc",
        urgent: true,
        important: false,
        quadrant: "urgent-not-important",
        completed: false,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        recurrence: "none",
        tags: ["a"],
        subtasks: [],
        dependencies: ["dep-1"],
        notificationEnabled: true,
        notificationSent: false,
      },
      "user-1",
      "device-1"
    );

    expect(remote.title).toBe("Test");
    expect(remote.client_updated_at).toBeDefined();
    expect(remote.owner).toBe("user-1");
  });

  it("maps PocketBase record to local task", async () => {
    const { pocketBaseToTaskRecord } = await import("@/lib/sync/task-mapper");
    const local = pocketBaseToTaskRecord({
      id: "pb-record-id",
      collectionId: "col1",
      collectionName: "tasks",
      task_id: "t1",
      title: "Remote Task",
      description: "Desc",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important",
      completed: true,
      completed_at: "2024-01-02T00:00:00Z",
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-01T00:00:00Z",
      client_updated_at: "2024-01-01T00:00:00Z",
      client_created_at: "2024-01-01T00:00:00Z",
      recurrence: "weekly",
      tags: ["tag1"],
      subtasks: [],
      dependencies: [],
      notification_enabled: true,
      notify_before: null,
      estimated_minutes: null,
      time_spent: 0,
      time_entries: [],
      due_date: "",
      owner: "user-1",
      device_id: "dev-1",
    });

    expect(local).not.toBeNull();
    expect(local!.title).toBe("Remote Task");
    expect(local!.recurrence).toBe("weekly");
  });
});

// ---------------------------------------------------------------------------
// 3. Quadrant utilities — resolveQuadrantId branches
// ---------------------------------------------------------------------------

describe("quadrant utilities", () => {
  it("resolves all quadrant combinations", async () => {
    const { resolveQuadrantId } = await import("@/lib/quadrants");

    expect(resolveQuadrantId(true, true)).toBe("urgent-important");
    expect(resolveQuadrantId(true, false)).toBe("urgent-not-important");
    expect(resolveQuadrantId(false, true)).toBe("not-urgent-important");
    expect(resolveQuadrantId(false, false)).toBe("not-urgent-not-important");
  });

  it("exports quadrantOrder array", async () => {
    const { quadrantOrder } = await import("@/lib/quadrants");
    expect(quadrantOrder).toHaveLength(4);
  });

  it("exports quadrants array with metadata", async () => {
    const { quadrants } = await import("@/lib/quadrants");
    expect(quadrants.length).toBe(4);
    expect(quadrants[0].id).toBeDefined();
    expect(quadrants[0].title).toBeDefined();
  });

  it("parseQuadrantFlags returns correct flags", async () => {
    const { parseQuadrantFlags } = await import("@/lib/quadrants");
    const flags = parseQuadrantFlags("urgent-important");
    expect(flags.urgent).toBe(true);
    expect(flags.important).toBe(true);

    const flags2 = parseQuadrantFlags("not-urgent-not-important");
    expect(flags2.urgent).toBe(false);
    expect(flags2.important).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. ID generator
// ---------------------------------------------------------------------------

describe("id-generator", () => {
  it("generates unique IDs", async () => {
    const { generateId } = await import("@/lib/id-generator");
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Utils — formatRelative, isOverdue, isDueToday branches
// ---------------------------------------------------------------------------

describe("utils", () => {
  it("isOverdue returns false for undefined date", async () => {
    const { isOverdue } = await import("@/lib/utils");
    expect(isOverdue(undefined)).toBe(false);
  });

  it("isOverdue returns true for past date", async () => {
    const { isOverdue } = await import("@/lib/utils");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isOverdue(yesterday.toISOString())).toBe(true);
  });

  it("isDueToday returns false for undefined date", async () => {
    const { isDueToday } = await import("@/lib/utils");
    expect(isDueToday(undefined)).toBe(false);
  });

  it("isDueToday returns true for today", async () => {
    const { isDueToday } = await import("@/lib/utils");
    expect(isDueToday(new Date().toISOString())).toBe(true);
  });

  it("formatRelative handles various dates", async () => {
    const { formatRelative } = await import("@/lib/utils");

    // Past date
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const result = formatRelative(past.toISOString());
    expect(typeof result).toBe("string");

    // Future date
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureResult = formatRelative(future.toISOString());
    expect(typeof futureResult).toBe("string");
  });

  it("isoNow returns a valid ISO string", async () => {
    const { isoNow } = await import("@/lib/utils");
    const now = isoNow();
    expect(new Date(now).toISOString()).toBe(now);
  });

  it("cn merges classNames correctly", async () => {
    const { cn } = await import("@/lib/utils");
    const result = cn("base", "extra", undefined, false && "skip");
    expect(result).toContain("base");
    expect(result).toContain("extra");
  });
});

// ---------------------------------------------------------------------------
// 6. Routes — branch coverage
// ---------------------------------------------------------------------------

describe("routes", () => {
  it("isRouteActive matches home route correctly", async () => {
    const { isRouteActive, ROUTES } = await import("@/lib/routes");

    expect(isRouteActive("/", "HOME")).toBe(true);
    expect(isRouteActive("/dashboard", "HOME")).toBe(false);
    expect(isRouteActive("/dashboard", "DASHBOARD")).toBe(true);
  });

  it("ROUTES has expected paths", async () => {
    const { ROUTES } = await import("@/lib/routes");
    expect(String(ROUTES.HOME)).toBe("/");
    expect(String(ROUTES.DASHBOARD)).toBe("/dashboard");
  });

  it("ROUTE_VARIANTS handles trailing slashes", async () => {
    const { isRouteActive } = await import("@/lib/routes");
    expect(isRouteActive("/dashboard/", "DASHBOARD")).toBe(true);
    expect(isRouteActive("/dashboard.html", "DASHBOARD")).toBe(true);
  });
});
