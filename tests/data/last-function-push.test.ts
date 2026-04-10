/**
 * Last push for function coverage — targeting remaining uncovered functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createMockTask } from "@/tests/fixtures";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// 1. Sync config get-set — cover getAutoSyncConfig
// ---------------------------------------------------------------------------

describe("sync config — remaining functions", () => {
  it("getAutoSyncConfig returns defaults when no config exists", async () => {
    const { getAutoSyncConfig } = await import("@/lib/sync/config/get-set");
    const config = await getAutoSyncConfig();
    expect(config.enabled).toBeDefined();
    expect(config.intervalMinutes).toBeDefined();
    expect(config.syncOnFocus).toBe(true);
    expect(config.syncOnOnline).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Task CRUD — subtask and dependency operations
// ---------------------------------------------------------------------------

describe("subtask and dependency operations", () => {
  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.tasks.clear();
  });

  it("addSubtask adds a subtask to a task", async () => {
    const { createTask, addSubtask } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Parent Task",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await addSubtask(task.id, "My Subtask");
    const db = getDb();
    const updated = await db.tasks.get(task.id);
    expect(updated?.subtasks.length).toBe(1);
    expect(updated?.subtasks[0].title).toBe("My Subtask");
  });

  it("toggleSubtask toggles subtask completion", async () => {
    const { createTask, addSubtask, toggleSubtask } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Parent",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await addSubtask(task.id, "Sub");
    const db = getDb();
    let updated = await db.tasks.get(task.id);
    const subtaskId = updated!.subtasks[0].id;

    await toggleSubtask(task.id, subtaskId, true);
    updated = await db.tasks.get(task.id);
    expect(updated?.subtasks[0].completed).toBe(true);
  });

  it("deleteSubtask removes a subtask", async () => {
    const { createTask, addSubtask, deleteSubtask } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");
    const task = await createTask({
      title: "Parent",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await addSubtask(task.id, "Sub to Delete");
    const db = getDb();
    let updated = await db.tasks.get(task.id);
    const subtaskId = updated!.subtasks[0].id;

    await deleteSubtask(task.id, subtaskId);
    updated = await db.tasks.get(task.id);
    expect(updated?.subtasks.length).toBe(0);
  });

  it("addDependency and removeDependency work", async () => {
    const { createTask, addDependency, removeDependency } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");

    const task1 = await createTask({
      title: "Task 1",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    const task2 = await createTask({
      title: "Task 2",
      description: "",
      urgent: false,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    await addDependency(task1.id, task2.id);
    const db = getDb();
    let updated = await db.tasks.get(task1.id);
    expect(updated?.dependencies).toContain(task2.id);

    await removeDependency(task1.id, task2.id);
    updated = await db.tasks.get(task1.id);
    expect(updated?.dependencies).not.toContain(task2.id);
  });

  it("clearSnooze removes snooze", async () => {
    const { createTask, snoozeTask, clearSnooze, isTaskSnoozed } = await import("@/lib/tasks");
    const { getDb } = await import("@/lib/db");

    const task = await createTask({
      title: "Snooze Test",
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
    await clearSnooze(task.id);

    const db = getDb();
    const updated = await db.tasks.get(task.id);
    expect(isTaskSnoozed(updated!)).toBe(false);
  });

  it("getRemainingSnoozeMinutes works", async () => {
    const { getRemainingSnoozeMinutes } = await import("@/lib/tasks");
    const task = createMockTask();
    expect(getRemainingSnoozeMinutes(task)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Export/Import operations
// ---------------------------------------------------------------------------

describe("export/import operations", () => {
  beforeEach(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.tasks.clear();
  });

  it("exportTasks returns structured payload", async () => {
    const { createTask, exportTasks } = await import("@/lib/tasks");

    await createTask({
      title: "Export Me",
      description: "",
      urgent: true,
      important: true,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    const exported = await exportTasks();
    expect(exported.tasks.length).toBeGreaterThanOrEqual(1);
    expect(exported.version).toBeDefined();
    expect(exported.exportedAt).toBeDefined();
  });

  it("exportToJson returns JSON string", async () => {
    const { createTask, exportToJson } = await import("@/lib/tasks");

    await createTask({
      title: "JSON Export",
      description: "",
      urgent: false,
      important: false,
      recurrence: "none",
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: false,
    });

    const json = await exportToJson();
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.tasks).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Dependencies module — circular detection
// ---------------------------------------------------------------------------

describe("dependency utilities", () => {
  it("wouldCreateCircularDependency detects cycles", async () => {
    const { wouldCreateCircularDependency } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a", dependencies: ["b"] }),
      createMockTask({ id: "b", dependencies: [] }),
    ];

    // Adding b -> a would create a cycle: a depends on b, b depends on a
    expect(wouldCreateCircularDependency("b", "a", tasks)).toBe(true);
  });

  it("wouldCreateCircularDependency returns false for no cycle", async () => {
    const { wouldCreateCircularDependency } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a", dependencies: [] }),
      createMockTask({ id: "b", dependencies: [] }),
    ];

    expect(wouldCreateCircularDependency("a", "b", tasks)).toBe(false);
  });

  it("isTaskBlocked returns true for task with uncompleted blockers", async () => {
    const { isTaskBlocked } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a", completed: false }),
      createMockTask({ id: "b", dependencies: ["a"] }),
    ];

    expect(isTaskBlocked(tasks[1], tasks)).toBe(true);
  });

  it("isTaskBlocking returns true when other tasks depend on it", async () => {
    const { isTaskBlocking } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a" }),
      createMockTask({ id: "b", dependencies: ["a"] }),
    ];

    expect(isTaskBlocking("a", tasks)).toBe(true);
    expect(isTaskBlocking("b", tasks)).toBe(false);
  });

  it("getReadyTasks returns tasks with no uncompleted blockers", async () => {
    const { getReadyTasks } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a", completed: false }),
      createMockTask({ id: "b", dependencies: ["a"], completed: false }),
      createMockTask({ id: "c", dependencies: [], completed: false }),
    ];

    const ready = getReadyTasks(tasks, tasks);
    const readyIds = ready.map((t) => t.id);
    expect(readyIds).toContain("a");
    expect(readyIds).toContain("c");
    expect(readyIds).not.toContain("b");
  });

  it("validateDependencies returns validation result", async () => {
    const { validateDependencies } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a", dependencies: [] }),
      createMockTask({ id: "b", dependencies: ["a"] }),
    ];

    const result = validateDependencies("b", ["a"], tasks);
    expect(result.valid).toBe(true);
  });

  it("getBlockedTasks returns tasks blocked by a given task", async () => {
    const { getBlockedTasks } = await import("@/lib/dependencies");

    const tasks = [
      createMockTask({ id: "a", dependencies: [] }),
      createMockTask({ id: "b", dependencies: ["a"] }),
      createMockTask({ id: "c", dependencies: ["a"] }),
    ];

    const blocked = getBlockedTasks("a", tasks);
    expect(blocked.length).toBe(2);
  });

  it("getUncompletedBlockingTasks returns only uncompleted blockers", async () => {
    const { getUncompletedBlockingTasks } = await import("@/lib/dependencies");

    const taskA = createMockTask({ id: "a", completed: false });
    const taskB = createMockTask({ id: "b", completed: true });
    const taskC = createMockTask({ id: "c", dependencies: ["a", "b"] });

    const blockers = getUncompletedBlockingTasks(taskC, [taskA, taskB, taskC]);
    expect(blockers.length).toBe(1);
    expect(blockers[0].id).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// 5. Task card memo — areTaskCardPropsEqual
// ---------------------------------------------------------------------------

describe("areTaskCardPropsEqual", () => {
  it("returns true when props are equal", async () => {
    const { areTaskCardPropsEqual } = await import("@/lib/task-card-memo");

    const task = createMockTask();
    const handlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleComplete: vi.fn(),
    };

    const props = { task, allTasks: [task], ...handlers };
    expect(areTaskCardPropsEqual(props, props)).toBe(true);
  });

  it("returns false when task title changes", async () => {
    const { areTaskCardPropsEqual } = await import("@/lib/task-card-memo");

    const handlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleComplete: vi.fn(),
    };

    const task1 = createMockTask({ title: "Old" });
    const task2 = createMockTask({ title: "New" });

    expect(
      areTaskCardPropsEqual(
        { task: task1, allTasks: [task1], ...handlers },
        { task: task2, allTasks: [task2], ...handlers }
      )
    ).toBe(false);
  });

  it("returns false when tags change", async () => {
    const { areTaskCardPropsEqual } = await import("@/lib/task-card-memo");

    const handlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleComplete: vi.fn(),
    };

    const task1 = createMockTask({ tags: ["a"] });
    const task2 = createMockTask({ tags: ["a", "b"] });

    expect(
      areTaskCardPropsEqual(
        { task: task1, allTasks: [task1], ...handlers },
        { task: task2, allTasks: [task2], ...handlers }
      )
    ).toBe(false);
  });

  it("returns false when selectionMode changes", async () => {
    const { areTaskCardPropsEqual } = await import("@/lib/task-card-memo");

    const task = createMockTask();
    const handlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleComplete: vi.fn(),
    };

    expect(
      areTaskCardPropsEqual(
        { task, allTasks: [task], ...handlers, selectionMode: false },
        { task, allTasks: [task], ...handlers, selectionMode: true }
      )
    ).toBe(false);
  });

  it("returns false when dependencies change in allTasks", async () => {
    const { areTaskCardPropsEqual } = await import("@/lib/task-card-memo");

    const task = createMockTask({ id: "t1", dependencies: ["t2"] });
    const dep1 = createMockTask({ id: "t2", completed: false });
    const dep2 = createMockTask({ id: "t2", completed: true });
    const handlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onToggleComplete: vi.fn(),
    };

    expect(
      areTaskCardPropsEqual(
        { task, allTasks: [task, dep1], ...handlers },
        { task, allTasks: [task, dep2], ...handlers }
      )
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. useDragAndDrop hook — basic render test
// ---------------------------------------------------------------------------

vi.mock("@dnd-kit/core", () => ({
  useSensors: vi.fn(() => []),
  useSensor: vi.fn(() => ({})),
  PointerSensor: {},
  TouchSensor: {},
}));

describe("useDragAndDrop", () => {
  it("returns handlers and state", async () => {
    const { useDragAndDrop } = await import("@/lib/use-drag-and-drop");
    const { result } = renderHook(() => useDragAndDrop(vi.fn()));

    expect(result.current.activeId).toBeNull();
    expect(typeof result.current.handleDragStart).toBe("function");
    expect(typeof result.current.handleDragEnd).toBe("function");
    expect(result.current.sensors).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. useQuickSettings — 8 uncovered functions
// ---------------------------------------------------------------------------

describe("useQuickSettings", () => {
  it("returns initial state and handlers", async () => {
    const { useQuickSettings } = await import("@/lib/use-quick-settings");
    const { result } = renderHook(() => useQuickSettings());

    expect(result.current.showCompleted).toBe(false);
    expect(typeof result.current.toggleShowCompleted).toBe("function");
    expect(typeof result.current.toggleNotifications).toBe("function");
    expect(typeof result.current.setSyncInterval).toBe("function");
  });

  it("toggleShowCompleted dispatches event", async () => {
    const { useQuickSettings } = await import("@/lib/use-quick-settings");
    const { result } = renderHook(() => useQuickSettings());

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    await act(async () => {
      result.current.toggleShowCompleted();
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "toggle-completed" })
    );

    dispatchSpy.mockRestore();
  });
});
