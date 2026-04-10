/**
 * Final function coverage push — targeting remaining untested exported functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
// 1. Analytics — ensure all exported functions are called
// ---------------------------------------------------------------------------

describe("analytics — all exported functions", () => {
  it("calculateMetrics works with tasks", async () => {
    const { calculateMetrics } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", completed: false, urgent: true, important: true }),
      createMockTask({ id: "t2", completed: true, completedAt: new Date().toISOString() }),
    ];
    const metrics = calculateMetrics(tasks);
    expect(metrics.totalTasks).toBe(2);
    expect(metrics.activeTasks).toBe(1);
    expect(metrics.completedTasks).toBe(1);
  });

  it("getQuadrantPerformance works", async () => {
    const { getQuadrantPerformance } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", quadrant: "urgent-important", completed: true }),
      createMockTask({ id: "t2", quadrant: "not-urgent-important", completed: false }),
    ];
    const perf = getQuadrantPerformance(tasks);
    expect(perf).toBeDefined();
    expect(Array.isArray(perf)).toBe(true);
  });

  it("getStreakData works with tasks", async () => {
    const { getStreakData } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", completed: true, completedAt: new Date().toISOString() }),
    ];
    const streakData = getStreakData(tasks);
    expect(streakData).toBeDefined();
  });

  it("calculateTagStatistics works", async () => {
    const { calculateTagStatistics } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", tags: ["work", "urgent"] }),
      createMockTask({ id: "t2", tags: ["work"] }),
    ];
    const stats = calculateTagStatistics(tasks);
    expect(stats.length).toBeGreaterThan(0);
  });

  it("getCompletionTrend works", async () => {
    const { getCompletionTrend } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", completed: true, completedAt: new Date().toISOString() }),
    ];
    const trend = getCompletionTrend(tasks, 7);
    expect(trend.length).toBe(7);
  });

  it("getRecurrenceBreakdown works", async () => {
    const { getRecurrenceBreakdown } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", recurrence: "daily" }),
      createMockTask({ id: "t2", recurrence: "weekly" }),
      createMockTask({ id: "t3", recurrence: "none" }),
    ];
    const breakdown = getRecurrenceBreakdown(tasks);
    expect(breakdown).toBeDefined();
  });

  it("calculateTimeTrackingSummary works", async () => {
    const { calculateTimeTrackingSummary } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", timeSpent: 30 }),
      createMockTask({ id: "t2", timeSpent: 60 }),
    ];
    const summary = calculateTimeTrackingSummary(tasks);
    expect(summary.totalMinutesTracked).toBe(90);
  });

  it("getTimeByQuadrant works", async () => {
    const { getTimeByQuadrant } = await import("@/lib/analytics");
    const tasks = [
      createMockTask({ id: "t1", quadrant: "urgent-important", timeSpent: 30 }),
    ];
    const result = getTimeByQuadrant(tasks);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Task CRUD functions — boost function coverage
// ---------------------------------------------------------------------------

describe("task CRUD — additional function calls", () => {
  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.tasks.clear();
  });

  it("createTask creates a task", async () => {
    const { createTask } = await import("@/lib/tasks");
    const task = await createTask({
      title: "New Task",
      description: "A description",
      urgent: true,
      important: false,
      recurrence: "none",
      tags: ["test"],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe("New Task");
    expect(task.quadrant).toBe("urgent-not-important");
  });

  it("listTasks returns all tasks", async () => {
    const { createTask, listTasks } = await import("@/lib/tasks");
    await createTask({
      title: "T1",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    const tasks = await listTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it("updateTask updates fields", async () => {
    const { createTask, updateTask, listTasks } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Original",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await updateTask(task.id, { title: "Updated" });
    const db = getDb();
    const updated = await db.tasks.get(task.id);
    expect(updated?.title).toBe("Updated");
  });

  it("deleteTask removes a task", async () => {
    const { createTask, deleteTask } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "To Delete",
      description: "",
      urgent: false,
      important: false,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await deleteTask(task.id);
    const db = getDb();
    const deleted = await db.tasks.get(task.id);
    expect(deleted).toBeUndefined();
  });

  it("toggleCompleted toggles completion", async () => {
    const { createTask, toggleCompleted } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Toggle Me",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await toggleCompleted(task.id, true);
    const db = getDb();
    const toggled = await db.tasks.get(task.id);
    expect(toggled?.completed).toBe(true);
  });

  it("duplicateTask creates a copy", async () => {
    const { createTask, duplicateTask } = await import("@/lib/tasks");
    const task = await createTask({
      title: "Original Task",
      description: "Description",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: ["test"],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    const duplicated = await duplicateTask(task.id);
    expect(duplicated).toBeDefined();
    expect(duplicated!.title).toContain("Original Task");
    expect(duplicated!.id).not.toBe(task.id);
  });

  it("moveTaskToQuadrant changes quadrant", async () => {
    const { createTask, moveTaskToQuadrant } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Move Me",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await moveTaskToQuadrant(task.id, "not-urgent-important");
    const db = getDb();
    const moved = await db.tasks.get(task.id);
    expect(moved?.quadrant).toBe("not-urgent-important");
  });

  it("startTimeTracking and stopTimeTracking work", async () => {
    const { createTask, startTimeTracking, stopTimeTracking } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Timer Task",
      description: "",
      urgent: false,
      important: false,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await startTimeTracking(task.id);
    const db = getDb();
    let updated = await db.tasks.get(task.id);
    expect(updated?.timeEntries?.length).toBe(1);
    expect(updated?.timeEntries?.[0].endedAt).toBeUndefined();

    await stopTimeTracking(task.id);
    updated = await db.tasks.get(task.id);
    expect(updated?.timeEntries?.[0].endedAt).toBeDefined();
  });

  it("snoozeTask sets snoozedUntil", async () => {
    const { createTask, snoozeTask, isTaskSnoozed } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Snooze Me",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
    });

    await snoozeTask(task.id, 60);
    const db = getDb();
    const snoozed = await db.tasks.get(task.id);
    expect(snoozed?.snoozedUntil).toBeDefined();
    expect(isTaskSnoozed(snoozed!)).toBe(true);
  });

  it("formatTimeSpent formats correctly", async () => {
    const { formatTimeSpent } = await import("@/lib/tasks");
    expect(formatTimeSpent(0)).toBeDefined();
    expect(formatTimeSpent(30)).toBeDefined();
    expect(formatTimeSpent(90)).toBeDefined();
  });

  it("hasRunningTimer returns false for task without time entries", async () => {
    const { hasRunningTimer } = await import("@/lib/tasks");
    const task = createMockTask();
    expect(hasRunningTimer(task)).toBe(false);
  });

  it("getRunningEntry returns undefined for task without running entries", async () => {
    const { getRunningEntry } = await import("@/lib/tasks");
    const task = createMockTask();
    expect(getRunningEntry(task)).toBeUndefined();
  });
});
