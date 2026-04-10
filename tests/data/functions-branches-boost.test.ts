/**
 * Boost function and branch coverage in data modules.
 * Targets: notifications/display, notifications/settings, use-count-up,
 * lib/archive, and various sync utility functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

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
// 1. useCountUp — covers all branches
// ---------------------------------------------------------------------------

describe("useCountUp", () => {
  it("returns target immediately in test env (skips animation)", async () => {
    const { useCountUp } = await import("@/lib/use-count-up");
    const { result } = renderHook(() => useCountUp(42));
    expect(result.current).toBe("42");
  });

  it("handles string target with suffix", async () => {
    const { useCountUp } = await import("@/lib/use-count-up");
    const { result } = renderHook(() => useCountUp("85%"));
    expect(result.current).toBe("85%");
  });

  it("handles zero target", async () => {
    const { useCountUp } = await import("@/lib/use-count-up");
    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe("0");
  });

  it("returns original string for non-numeric input", async () => {
    const { useCountUp } = await import("@/lib/use-count-up");
    const { result } = renderHook(() => useCountUp("N/A"));
    expect(result.current).toBe("N/A");
  });

  it("handles NaN input gracefully", async () => {
    const { useCountUp } = await import("@/lib/use-count-up");
    const { result } = renderHook(() => useCountUp(NaN));
    expect(result.current).toBe("NaN");
  });

  it("handles Infinity input gracefully", async () => {
    const { useCountUp } = await import("@/lib/use-count-up");
    const { result } = renderHook(() => useCountUp(Infinity));
    expect(result.current).toBe("Infinity");
  });
});

// ---------------------------------------------------------------------------
// 2. Notification settings — CRUD
// ---------------------------------------------------------------------------

describe("notification settings", () => {
  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.notificationSettings.clear();
  });

  it("getNotificationSettings creates defaults when none exist", async () => {
    const { getNotificationSettings } = await import(
      "@/lib/notifications/settings"
    );

    const settings = await getNotificationSettings();
    expect(settings.id).toBe("settings");
    expect(settings.enabled).toBe(true);
    expect(settings.soundEnabled).toBe(true);
  });

  it("getNotificationSettings returns existing settings", async () => {
    const { getNotificationSettings, updateNotificationSettings } =
      await import("@/lib/notifications/settings");

    // Create initial settings first
    await getNotificationSettings();

    // Update
    await updateNotificationSettings({ enabled: false, soundEnabled: false });

    const settings = await getNotificationSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.soundEnabled).toBe(false);
  });

  it("updateNotificationSettings preserves id field", async () => {
    const { getNotificationSettings, updateNotificationSettings } =
      await import("@/lib/notifications/settings");

    await getNotificationSettings(); // initialize
    await updateNotificationSettings({ defaultReminder: 30 });

    const settings = await getNotificationSettings();
    expect(settings.id).toBe("settings");
    expect(settings.defaultReminder).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 3. Notification display — showTaskNotification branches
// ---------------------------------------------------------------------------

describe("notification display", () => {
  it("showTaskNotification returns early when notifications not supported", async () => {
    const originalNotification = globalThis.Notification;
    // @ts-expect-error - intentionally removing for test
    delete globalThis.Notification;

    vi.resetModules();
    const { showTaskNotification } = await import(
      "@/lib/notifications/display"
    );

    const task = {
      id: "t1",
      title: "Test",
      description: "",
      urgent: true,
      important: true,
      quadrant: "urgent-important" as const,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    };

    // Should not throw
    await expect(showTaskNotification(task, 10)).resolves.toBeUndefined();

    globalThis.Notification = originalNotification;
  });
});

// ---------------------------------------------------------------------------
// 4. Archive operations
// ---------------------------------------------------------------------------

describe("archive operations", () => {
  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.tasks.clear();
    await db.archivedTasks.clear();
    await db.archiveSettings.clear();
  });

  it("listArchivedTasks returns empty array when no archived tasks", async () => {
    const { listArchivedTasks } = await import("@/lib/archive");
    const tasks = await listArchivedTasks();
    expect(tasks).toEqual([]);
  });

  it("archiveOldTasks moves completed old tasks to archive", async () => {
    const { getDb } = await import("@/lib/db");
    const { archiveOldTasks, listArchivedTasks } = await import("@/lib/archive");

    const db = getDb();
    // Create a task completed 60 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 60);

    const task = {
      id: "archive-test-1",
      title: "Old Completed Task",
      description: "",
      urgent: true,
      important: true,
      quadrant: "urgent-important" as const,
      completed: true,
      createdAt: pastDate.toISOString(),
      updatedAt: pastDate.toISOString(),
      completedAt: pastDate.toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    };

    await db.tasks.add(task);
    const count = await archiveOldTasks(30);

    expect(count).toBe(1);

    const archived = await listArchivedTasks();
    expect(archived.length).toBe(1);
    expect(archived[0].id).toBe("archive-test-1");

    // Task should be removed from active
    const active = await db.tasks.get(task.id);
    expect(active).toBeUndefined();
  });

  it("archiveOldTasks returns 0 when no old tasks", async () => {
    const { archiveOldTasks } = await import("@/lib/archive");
    const count = await archiveOldTasks(30);
    expect(count).toBe(0);
  });

  it("getArchivedCount returns the count of archived tasks", async () => {
    const { getDb } = await import("@/lib/db");
    const { getArchivedCount } = await import("@/lib/archive");

    const db = getDb();
    await db.archivedTasks.add({
      id: "count-test-1",
      title: "Archived",
      description: "",
      urgent: false,
      important: false,
      quadrant: "not-urgent-not-important" as const,
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    });

    const count = await getArchivedCount();
    expect(count).toBe(1);
  });

  it("restoreTask moves a task from archived to active", async () => {
    const { getDb } = await import("@/lib/db");
    const { restoreTask } = await import("@/lib/archive");

    const db = getDb();
    const task = {
      id: "restore-test-1",
      title: "Archived Task",
      description: "",
      urgent: false,
      important: false,
      quadrant: "not-urgent-not-important" as const,
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    };

    await db.archivedTasks.add(task);
    await restoreTask("restore-test-1");

    const restoredFromActive = await db.tasks.get("restore-test-1");
    expect(restoredFromActive).toBeDefined();

    const stillArchived = await db.archivedTasks.get("restore-test-1");
    expect(stillArchived).toBeUndefined();
  });

  it("deleteArchivedTask permanently removes a task", async () => {
    const { getDb } = await import("@/lib/db");
    const { deleteArchivedTask, listArchivedTasks } = await import(
      "@/lib/archive"
    );

    const db = getDb();
    await db.archivedTasks.add({
      id: "delete-test-1",
      title: "To Delete",
      description: "",
      urgent: false,
      important: false,
      quadrant: "not-urgent-not-important" as const,
      completed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    });

    await deleteArchivedTask("delete-test-1");
    const tasks = await listArchivedTasks();
    expect(tasks.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Archive settings
// ---------------------------------------------------------------------------

describe("archive settings", () => {
  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.archiveSettings.clear();
  });

  it("getArchiveSettings returns defaults when none exist", async () => {
    const { getArchiveSettings } = await import("@/lib/archive");
    const settings = await getArchiveSettings();

    expect(settings.enabled).toBe(false);
    expect(settings.archiveAfterDays).toBe(30);
  });

  it("updateArchiveSettings saves new settings", async () => {
    const { getArchiveSettings, updateArchiveSettings } = await import(
      "@/lib/archive"
    );

    // Initialize defaults first (creates the record)
    await getArchiveSettings();

    await updateArchiveSettings({ enabled: true, archiveAfterDays: 14 });
    const settings = await getArchiveSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.archiveAfterDays).toBe(14);
  });
});
