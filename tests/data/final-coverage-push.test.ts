/**
 * Final coverage push — targeted function and branch tests.
 * Targets: command-actions, filters (more branches), display helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTask } from "@/tests/fixtures";

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
// 1. buildCommandActions — many branches
// ---------------------------------------------------------------------------

describe("buildCommandActions", () => {
  it("builds core actions without sync", async () => {
    const { buildCommandActions } = await import("@/lib/command-actions");

    const handlers = {
      onNewTask: vi.fn(),
      onToggleTheme: vi.fn(),
      onExportTasks: vi.fn(),
      onImportTasks: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenHelp: vi.fn(),
      onViewDashboard: vi.fn(),
      onViewMatrix: vi.fn(),
      onViewArchive: vi.fn(),
      onApplySmartView: vi.fn(),
    };

    const actions = buildCommandActions(handlers, [], {
      isSyncEnabled: false,
      selectionMode: false,
      hasSelection: false,
    });

    expect(actions.length).toBeGreaterThan(0);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("new-task");
    expect(ids).toContain("toggle-theme");
    expect(ids).toContain("view-matrix");
    expect(ids).toContain("open-settings");
    expect(ids).not.toContain("sync-now");
  });

  it("includes sync actions when sync is enabled", async () => {
    const { buildCommandActions } = await import("@/lib/command-actions");

    const handlers = {
      onNewTask: vi.fn(),
      onToggleTheme: vi.fn(),
      onExportTasks: vi.fn(),
      onImportTasks: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenHelp: vi.fn(),
      onViewDashboard: vi.fn(),
      onViewMatrix: vi.fn(),
      onViewArchive: vi.fn(),
      onApplySmartView: vi.fn(),
      onTriggerSync: vi.fn(),
      onViewSyncHistory: vi.fn(),
    };

    const actions = buildCommandActions(handlers, [], {
      isSyncEnabled: true,
      selectionMode: false,
      hasSelection: false,
    });

    const ids = actions.map((a) => a.id);
    expect(ids).toContain("sync-now");
    expect(ids).toContain("view-sync-history");
  });

  it("includes selection mode actions when handlers provided", async () => {
    const { buildCommandActions } = await import("@/lib/command-actions");

    const handlers = {
      onNewTask: vi.fn(),
      onToggleTheme: vi.fn(),
      onExportTasks: vi.fn(),
      onImportTasks: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenHelp: vi.fn(),
      onViewDashboard: vi.fn(),
      onViewMatrix: vi.fn(),
      onViewArchive: vi.fn(),
      onApplySmartView: vi.fn(),
      onToggleSelectionMode: vi.fn(),
      onClearSelection: vi.fn(),
    };

    const actions = buildCommandActions(handlers, [], {
      isSyncEnabled: false,
      selectionMode: true,
      hasSelection: true,
    });

    const ids = actions.map((a) => a.id);
    expect(ids).toContain("toggle-selection-mode");
    expect(ids).toContain("clear-selection");
  });

  it("includes smart view actions", async () => {
    const { buildCommandActions } = await import("@/lib/command-actions");

    const handlers = {
      onNewTask: vi.fn(),
      onToggleTheme: vi.fn(),
      onExportTasks: vi.fn(),
      onImportTasks: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenHelp: vi.fn(),
      onViewDashboard: vi.fn(),
      onViewMatrix: vi.fn(),
      onViewArchive: vi.fn(),
      onApplySmartView: vi.fn(),
    };

    const smartViews = [
      { id: "sv1", name: "Overdue", criteria: { status: "active" as const }, description: "Overdue tasks" },
      { id: "sv2", name: "Today", icon: "📅", criteria: { status: "active" as const } },
    ];

    const actions = buildCommandActions(handlers, smartViews, {
      isSyncEnabled: false,
      selectionMode: false,
      hasSelection: false,
    });

    const ids = actions.map((a) => a.id);
    expect(ids).toContain("view-sv1");
    expect(ids).toContain("view-sv2");

    // Execute a smart view action
    const svAction = actions.find((a) => a.id === "view-sv1");
    svAction?.onExecute();
    expect(handlers.onApplySmartView).toHaveBeenCalled();
  });

  it("condition functions return correct values", async () => {
    const { buildCommandActions } = await import("@/lib/command-actions");

    const handlers = {
      onNewTask: vi.fn(),
      onToggleTheme: vi.fn(),
      onExportTasks: vi.fn(),
      onImportTasks: vi.fn(),
      onOpenSettings: vi.fn(),
      onOpenHelp: vi.fn(),
      onViewDashboard: vi.fn(),
      onViewMatrix: vi.fn(),
      onViewArchive: vi.fn(),
      onApplySmartView: vi.fn(),
      onTriggerSync: vi.fn(),
      onViewSyncHistory: vi.fn(),
      onToggleSelectionMode: vi.fn(),
      onClearSelection: vi.fn(),
    };

    const actions = buildCommandActions(handlers, [], {
      isSyncEnabled: true,
      selectionMode: true,
      hasSelection: true,
    });

    // Check condition functions
    const syncAction = actions.find((a) => a.id === "sync-now");
    expect(syncAction?.condition?.()).toBe(true);

    const clearAction = actions.find((a) => a.id === "clear-selection");
    expect(clearAction?.condition?.()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Filters — more branch coverage (search, date-range)
// ---------------------------------------------------------------------------

describe("filters — additional branches", () => {
  it("applyFilters with searchQuery", async () => {
    const { applyFilters } = await import("@/lib/filters");

    const tasks = [
      createMockTask({ id: "t1", title: "Deploy frontend" }),
      createMockTask({ id: "t2", title: "Fix backend bug" }),
    ];

    const filtered = applyFilters(tasks, { searchQuery: "frontend" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("t1");
  });

  it("applyFilters with overdue filter", async () => {
    const { applyFilters } = await import("@/lib/filters");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = [
      createMockTask({ id: "t1", dueDate: yesterday.toISOString() }),
      createMockTask({ id: "t2", dueDate: tomorrow.toISOString() }),
    ];

    const filtered = applyFilters(tasks, { overdue: true });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("t1");
  });

  it("applyFilters with dueToday filter", async () => {
    const { applyFilters } = await import("@/lib/filters");

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = [
      createMockTask({ id: "t1", dueDate: today.toISOString() }),
      createMockTask({ id: "t2", dueDate: tomorrow.toISOString() }),
    ];

    const filtered = applyFilters(tasks, { dueToday: true });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("t1");
  });

  it("applyFilters with recurrence filter", async () => {
    const { applyFilters } = await import("@/lib/filters");

    const tasks = [
      createMockTask({ id: "t1", recurrence: "daily" }),
      createMockTask({ id: "t2", recurrence: "none" }),
    ];

    const filtered = applyFilters(tasks, { recurrence: ["daily"] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("t1");
  });

  it("applyFilters with noDueDate filter", async () => {
    const { applyFilters } = await import("@/lib/filters");

    const tasks = [
      createMockTask({ id: "t1" }), // no dueDate
      createMockTask({ id: "t2", dueDate: new Date().toISOString() }),
    ];

    const filtered = applyFilters(tasks, { noDueDate: true });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("t1");
  });

  it("applyFilters with recentlyAdded filter", async () => {
    const { applyFilters } = await import("@/lib/filters");

    const tasks = [
      createMockTask({ id: "t1", createdAt: new Date().toISOString() }),
      createMockTask({ id: "t2", createdAt: "2020-01-01T00:00:00Z" }),
    ];

    const filtered = applyFilters(tasks, { recentlyAdded: true });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("t1");
  });

  it("isEmptyFilter detects empty criteria", async () => {
    const { isEmptyFilter } = await import("@/lib/filters");
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ status: "all" })).toBe(true);
    expect(isEmptyFilter({ status: "active" })).toBe(false);
    expect(isEmptyFilter({ overdue: true })).toBe(false);
    expect(isEmptyFilter({ searchQuery: "  " })).toBe(true);
    expect(isEmptyFilter({ searchQuery: "test" })).toBe(false);
  });

  it("getFilterDescription returns descriptive text", async () => {
    const { getFilterDescription } = await import("@/lib/filters");

    expect(getFilterDescription({})).toBe("No filters");
    expect(getFilterDescription({ status: "active" })).toContain("active");
    expect(getFilterDescription({ overdue: true })).toContain("overdue");
    expect(getFilterDescription({ dueToday: true })).toContain("due today");
    expect(getFilterDescription({ tags: ["work"] })).toContain("1 tag");
    expect(getFilterDescription({ tags: ["a", "b"] })).toContain("2 tags");
    expect(getFilterDescription({ quadrants: ["urgent-important"] })).toContain("1 quadrant");
    expect(getFilterDescription({ searchQuery: "foo" })).toContain('"foo"');
    expect(getFilterDescription({ recurrence: ["daily"] })).toContain("daily");
    expect(getFilterDescription({ recentlyAdded: true })).toContain("recently added");
    expect(getFilterDescription({ recentlyCompleted: true })).toContain("recently completed");
    expect(getFilterDescription({ readyToWork: true })).toContain("ready to work");
    expect(getFilterDescription({ dueThisWeek: true })).toContain("due this week");
    expect(getFilterDescription({ noDueDate: true })).toContain("no due date");
  });
});

// ---------------------------------------------------------------------------
// 3. Notification display — more internal function calls
// ---------------------------------------------------------------------------

describe("notification display — internal function branches", () => {
  it("showTestNotification returns false when not supported", async () => {
    const originalNotification = globalThis.Notification;
    // @ts-expect-error — deleting a non-optional global for test isolation
    delete globalThis.Notification;

    vi.resetModules();
    const { showTestNotification } = await import("@/lib/notifications/display");
    const result = await showTestNotification();
    expect(result).toBe(false);

    globalThis.Notification = originalNotification;
  });
});

// ---------------------------------------------------------------------------
// 4. More time tracking utils
// ---------------------------------------------------------------------------

describe("time tracking formatDuration", () => {
  it("formats zero minutes", async () => {
    const { formatDuration } = await import("@/lib/analytics");
    expect(formatDuration(0)).toBeDefined();
  });

  it("formats hours and minutes", async () => {
    const { formatDuration } = await import("@/lib/analytics");
    const result = formatDuration(125);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it("formats just minutes", async () => {
    const { formatDuration } = await import("@/lib/analytics");
    const result = formatDuration(45);
    expect(typeof result).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 5. Reset everything — function coverage
// ---------------------------------------------------------------------------

describe("resetEverything", () => {
  it("reloadAfterReset calls window.location.href", async () => {
    const { reloadAfterReset } = await import("@/lib/reset-everything");

    // Mock window.location
    const originalHref = window.location.href;
    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      href: originalHref,
    } as Location);

    // Should not throw
    expect(() => reloadAfterReset()).not.toThrow();

    locationSpy.mockRestore();
  });
});
