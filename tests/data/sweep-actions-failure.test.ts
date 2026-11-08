import { beforeEach, describe, expect, it, vi } from "vitest";
import { markUrgent, moveToQuadrant } from "@/components/weekly-sweep/sweep-actions";
import { createMockTask } from "@/tests/fixtures";

const lib = vi.hoisted(() => ({
  updateTask: vi.fn(),
  moveTaskToQuadrant: vi.fn(),
}));

vi.mock("@/lib/tasks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tasks")>()),
  updateTask: lib.updateTask,
  moveTaskToQuadrant: lib.moveTaskToQuadrant,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));
vi.mock("@/lib/error-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logger")>()),
  logError: vi.fn(),
}));

const task = createMockTask({ id: "t1", urgent: false, important: true });

describe("a sweep action that fails doesn't move the sweep on (S12)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Mark urgent resolves true when the write works", async () => {
    lib.updateTask.mockResolvedValue({ ...task, urgent: true });

    expect(await markUrgent(task, vi.fn())).toBe(true);
  });

  it("Mark urgent resolves false when the write fails", async () => {
    lib.updateTask.mockRejectedValue(new Error("boom"));

    expect(await markUrgent(task, vi.fn())).toBe(false);
  });

  it("Move to quadrant resolves false when the write fails", async () => {
    lib.moveTaskToQuadrant.mockRejectedValue(new Error("boom"));

    expect(await moveToQuadrant(task, "urgent-important", vi.fn())).toBe(false);
  });

  it("Move to quadrant resolves true when the write works", async () => {
    lib.moveTaskToQuadrant.mockResolvedValue(task);

    expect(await moveToQuadrant(task, "urgent-important", vi.fn())).toBe(true);
  });
});
