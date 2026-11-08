import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSweepSession } from "@/components/weekly-sweep/use-sweep-session";
import { SWEEP_LAST_SWEPT_KEY, readLastSwept } from "@/lib/preferences/weekly-sweep";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";

const NOW = new Date("2026-11-08T16:00:00.000Z");
const ZONE = "America/Chicago";
const OLD = "2026-09-01T00:00:00.000Z";

const overdue = (id: string, due: string): TaskRecord =>
  createMockTask({ id, title: `Task ${id}`, dueDate: due, urgent: false, important: false, updatedAt: "2026-11-07T00:00:00.000Z" });

const tasks = [overdue("a", "2026-11-01T12:00:00.000Z"), overdue("b", "2026-11-02T12:00:00.000Z"), overdue("c", "2026-11-03T12:00:00.000Z")];

function open(all: TaskRecord[]) {
  return renderHook(({ list }) => useSweepSession(list, false, { now: NOW, zone: ZONE, windowDays: 2 }), {
    initialProps: { list: all },
  });
}

describe("useSweepSession", () => {
  beforeEach(() => localStorage.removeItem(SWEEP_LAST_SWEPT_KEY));

  it("opens on the first card with a position line", () => {
    const { result } = open(tasks);

    expect(result.current.status).toBe("card");
    expect(result.current.card?.task.id).toBe("a");
    expect(result.current.position).toBe("1 of 3");
  });

  it("Skip goes to the next card and writes nothing, not even last swept", () => {
    const { result } = open(tasks);

    act(() => result.current.advance());

    expect(result.current.card?.task.id).toBe("b");
    expect(result.current.position).toBe("2 of 3");
    expect(readLastSwept()).toBeNull();
  });

  it("reaching the end stamps last swept once", () => {
    const { result } = open(tasks);

    act(() => result.current.advance());
    act(() => result.current.advance());
    act(() => result.current.advance());

    expect(result.current.status).toBe("end");
    expect(readLastSwept()).not.toBeNull();
  });

  it("Done stamps last swept", () => {
    const { result } = open(tasks);

    act(() => result.current.done());

    expect(readLastSwept()).not.toBeNull();
  });

  it("leaving without Done stamps nothing", () => {
    const { unmount } = open(tasks);

    unmount();

    expect(readLastSwept()).toBeNull();
  });

  it("skips, without saying so, a task completed elsewhere mid-sweep", () => {
    const { result, rerender } = open(tasks);

    rerender({ list: [tasks[0], { ...tasks[1], completed: true }, tasks[2]] });
    act(() => result.current.advance());

    expect(result.current.card?.task.id).toBe("c");
  });

  it("skips a task that was deleted mid-sweep", () => {
    const { result, rerender } = open(tasks);

    rerender({ list: [tasks[0], tasks[2]] });
    act(() => result.current.advance());

    expect(result.current.card?.task.id).toBe("c");
  });

  it("with no cards shows the end state at once and stamps nothing", () => {
    const { result } = open([createMockTask({ id: "fresh", updatedAt: "2026-11-08T00:00:00.000Z" })]);

    expect(result.current.status).toBe("end");
    expect(result.current.total).toBe(0);
    expect(readLastSwept()).toBeNull();
  });

  it("does not reorder cards when a later sync changes the list", () => {
    const { result, rerender } = open(tasks);

    rerender({ list: [...tasks, overdue("z", "2026-10-01T12:00:00.000Z")] });

    expect(result.current.card?.task.id).toBe("a");
    expect(result.current.total).toBe(3);
  });

  it("waits while tasks load", () => {
    const { result } = renderHook(() => useSweepSession([], true, { now: NOW, zone: ZONE, windowDays: 2 }));

    expect(result.current.status).toBe("loading");
  });
});
