import { describe, it, expect } from "vitest";
import { deriveMatrixView, filterTasks } from "@/components/matrix-simplified/matrix-view";
import type { TaskRecord } from "@/lib/types";
import type { SmartView } from "@/lib/filters";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: overrides.id ?? `task-${Math.random().toString(36).slice(2)}`,
    title: "Task",
    description: "",
    urgent: false,
    important: false,
    quadrant: "not-urgent-not-important",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
    ...overrides,
  };
}

const completedView: SmartView = {
  id: "built-in-completed",
  name: "All Completed",
  icon: "✅",
  criteria: { status: "completed" },
  isBuiltIn: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("filterTasks", () => {
  it("returns all tasks for an empty query", () => {
    const tasks = [makeTask(), makeTask()];
    expect(filterTasks(tasks, "")).toHaveLength(2);
  });

  it("matches title, description, tags, and subtasks case-insensitively", () => {
    const byTitle = makeTask({ id: "t", title: "Ship Release" });
    const byDesc = makeTask({ id: "d", description: "needs the SHIP done" });
    const byTag = makeTask({ id: "g", tags: ["shipping"] });
    const bySub = makeTask({ id: "s", subtasks: [{ id: "x", title: "Ship it", completed: false }] });
    const noMatch = makeTask({ id: "n", title: "unrelated" });

    const result = filterTasks([byTitle, byDesc, byTag, bySub, noMatch], "ship");

    expect(result.map((t) => t.id).sort()).toEqual(["d", "g", "s", "t"]);
  });
});

describe("deriveMatrixView", () => {
  const active = makeTask({ id: "active", title: "Active alpha", completed: false });
  const done = makeTask({ id: "done", title: "Done bravo", completed: true });
  const overdue = makeTask({ id: "od", title: "Overdue", completed: false, dueDate: "2000-01-01" });

  it("counts total, completed, and overdue", () => {
    const view = deriveMatrixView({
      all: [active, done, overdue],
      showCompleted: false,
      smartViewsEnabled: false,
      activeSmartView: null,
      searchQuery: "",
    });
    expect(view.total).toBe(3);
    expect(view.completed).toBe(1);
    expect(view.overdue).toBe(1);
  });

  it("hides completed tasks when showCompleted is false and no smart view is active", () => {
    const view = deriveMatrixView({
      all: [active, done],
      showCompleted: false,
      smartViewsEnabled: false,
      activeSmartView: null,
      searchQuery: "",
    });
    expect(view.visibleTasks.map((t) => t.id)).toEqual(["active"]);
  });

  it("shows completed tasks when showCompleted is true", () => {
    const view = deriveMatrixView({
      all: [active, done],
      showCompleted: true,
      smartViewsEnabled: false,
      activeSmartView: null,
      searchQuery: "",
    });
    expect(view.visibleTasks.map((t) => t.id).sort()).toEqual(["active", "done"]);
  });

  it("applies an active smart view over the full task set when enabled", () => {
    const view = deriveMatrixView({
      all: [active, done],
      showCompleted: false,
      smartViewsEnabled: true,
      activeSmartView: completedView,
      searchQuery: "",
    });
    expect(view.visibleTasks.map((t) => t.id)).toEqual(["done"]);
  });

  it("ignores the active smart view when the feature is disabled", () => {
    const view = deriveMatrixView({
      all: [active, done],
      showCompleted: false,
      smartViewsEnabled: false,
      activeSmartView: completedView,
      searchQuery: "",
    });
    expect(view.visibleTasks.map((t) => t.id)).toEqual(["active"]);
  });

  it("applies the search query on top of the visible set", () => {
    const view = deriveMatrixView({
      all: [active, makeTask({ id: "other", title: "zzz" })],
      showCompleted: false,
      smartViewsEnabled: false,
      activeSmartView: null,
      searchQuery: "  alpha  ",
    });
    expect(view.visibleTasks.map((t) => t.id)).toEqual(["active"]);
  });
});
