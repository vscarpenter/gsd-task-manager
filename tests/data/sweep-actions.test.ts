import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import {
  actionsFor,
  completeTask,
  moveToQuadrant,
  removeTask,
  returnToMatrix,
  saveForLater,
  setDueDay,
} from "@/components/weekly-sweep/sweep-actions";
import { createMockTask } from "@/tests/fixtures";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

type Undo = () => Promise<void>;

function recorder() {
  let undo: Undo | null = null;
  return {
    offer: (_message: string, fn: Undo) => {
      undo = fn;
    },
    undo: () => undo!(),
  };
}

async function seed(patch = {}) {
  await getDb().tasks.clear();
  await getDb().deletedTasks.clear();
  const task = createMockTask({ id: "t1", urgent: false, important: false, ...patch });
  await getDb().tasks.put(task);
  return task;
}

describe("sweep actions call the paths that already exist", () => {
  beforeEach(async () => {
    await seed();
  });

  it("Complete completes the task and Undo brings it back", async () => {
    const task = await seed();
    const r = recorder();

    expect(await completeTask(task, r.offer)).toBe(true);
    expect((await getDb().tasks.get("t1"))?.completed).toBe(true);

    await r.undo();
    expect((await getDb().tasks.get("t1"))?.completed).toBe(false);
  });

  it("New date keeps a time of day already set, and Undo restores the old date", async () => {
    const task = await seed({ dueDate: new Date("2026-11-01T15:30:00").toISOString() });
    const r = recorder();

    await setDueDay(task, "2026-11-12", r.offer);

    const moved = new Date((await getDb().tasks.get("t1"))!.dueDate!);
    expect([moved.getFullYear(), moved.getMonth() + 1, moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([2026, 11, 12, 15, 30]);
    await r.undo();
    expect((await getDb().tasks.get("t1"))?.dueDate).toBe(task.dueDate);
  });

  it("Add date on an undated task makes it all day", async () => {
    const task = await seed({ dueDate: undefined });

    await setDueDay(task, "2026-11-12", recorder().offer);

    const due = new Date((await getDb().tasks.get("t1"))!.dueDate!);
    expect([due.getHours(), due.getMinutes()]).toEqual([0, 0]);
  });

  it("Save for later moves the task to Saved", async () => {
    const task = await seed();

    expect(await saveForLater(task, recorder().offer)).toBe(true);

    expect((await getDb().tasks.get("t1"))?.savedAt).toBeTruthy();
  });

  it("Delete moves the task to Trash and Undo restores it", async () => {
    const task = await seed();
    const r = recorder();

    await removeTask(task, r.offer);
    expect(await getDb().tasks.get("t1")).toBeUndefined();
    expect(await getDb().deletedTasks.get("t1")).toBeTruthy();

    await r.undo();
    expect(await getDb().tasks.get("t1")).toBeTruthy();
  });

  it("Move to quadrant moves it", async () => {
    const task = await seed();

    await moveToQuadrant(task, "urgent-important", recorder().offer);

    expect((await getDb().tasks.get("t1"))?.quadrant).toBe("urgent-important");
  });

  it("Return to matrix puts a saved task back in the chosen quadrant", async () => {
    const task = await seed({ savedAt: "2026-09-01T00:00:00.000Z" });

    expect(await returnToMatrix(task, "not-urgent-important", recorder().offer)).toBe(true);

    const row = await getDb().tasks.get("t1");
    expect(row?.savedAt).toBeUndefined();
    expect(row?.quadrant).toBe("not-urgent-important");
  });
});

describe("the actions on each card (spec section 5)", () => {
  const plain = createMockTask({ urgent: false });
  const urgent = createMockTask({ urgent: true });

  it.each([
    ["overdue", plain, ["complete", "new-date", "mark-urgent", "save", "delete", "skip"]],
    ["overdue", urgent, ["complete", "new-date", "save", "delete", "skip"]],
    ["escalating", plain, ["mark-urgent", "new-date", "complete", "skip"]],
    ["stale", plain, ["complete", "move", "new-date", "save", "delete", "skip"]],
    ["saved", plain, ["return", "delete", "skip"]],
    ["undated-schedule", plain, ["new-date", "move", "save", "skip"]],
  ] as const)("%s offers the right set", (reason, task, expected) => {
    expect(actionsFor(reason, task)).toEqual(expected);
  });
});
