/**
 * A stored instant may carry an offset, so its text order isn't its time order.
 * Each case puts two stamps where the two orders disagree.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { archiveOldTasks } from "@/lib/archive";
import { getDb } from "@/lib/db";
import { suggest, todaysPicks } from "@/lib/top-three";
import { listTrashedTasks } from "@/lib/trash";
import { useTasks } from "@/lib/use-tasks";
import { createMockTask } from "@/tests/fixtures";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 01:00Z on the 20th is later than 22:00Z on the 19th, and its text is earlier.
const LATER = "2026-10-19T20:00:00.000-05:00";
const EARLIER = "2026-10-19T22:00:00.000Z";

/** The same instant, written as a client at that UTC offset writes it. */
function atOffset(ms: number, hours: number): string {
  const sign = hours < 0 ? "-" : "+";
  const wall = new Date(ms + hours * HOUR).toISOString().slice(0, -1);
  return `${wall}${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("auto-archive", () => {
  it("keeps a task completed inside the window in a zone behind UTC", async () => {
    const completedAt = atOffset(Date.now() - 30 * DAY + 2 * HOUR, -5);
    await getDb().tasks.put(createMockTask({ id: "recent", completed: true, completedAt }));

    expect(await archiveOldTasks(30)).toBe(0);
  });

  it("archives a task completed outside the window in a zone ahead of UTC", async () => {
    const completedAt = atOffset(Date.now() - 30 * DAY - 2 * HOUR, 5);
    await getDb().tasks.put(createMockTask({ id: "old", completed: true, completedAt }));

    expect(await archiveOldTasks(30)).toBe(1);
  });
});

describe("lists", () => {
  it("puts the newest deletion first in Trash", async () => {
    await getDb().deletedTasks.bulkPut([
      { ...createMockTask({ id: "earlier" }), deletedAt: EARLIER },
      { ...createMockTask({ id: "later" }), deletedAt: LATER },
    ]);

    expect((await listTrashedTasks()).map((task) => task.id)).toEqual(["later", "earlier"]);
  });

  it("orders live tasks by when they were created", async () => {
    await getDb().tasks.bulkPut([
      createMockTask({ id: "later", createdAt: LATER }),
      createMockTask({ id: "earlier", createdAt: EARLIER }),
    ]);

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.all).toHaveLength(2));
    expect(result.current.all.map((task) => task.id)).toEqual(["earlier", "later"]);
  });

  it("puts the newest save first in Saved", async () => {
    await getDb().tasks.bulkPut([
      createMockTask({ id: "earlier", savedAt: EARLIER }),
      createMockTask({ id: "later", savedAt: LATER }),
    ]);

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.saved).toHaveLength(2));
    expect(result.current.saved.map((task) => task.id)).toEqual(["later", "earlier"]);
  });
});

describe("top three", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");

  it("gives a shared rank to the newest edit", () => {
    const picked = { focusDate: "2026-10-20", focusRank: 1 } as const;

    const { picks } = todaysPicks(
      [
        createMockTask({ id: "earlier", ...picked, updatedAt: EARLIER }),
        createMockTask({ id: "later", ...picked, updatedAt: LATER }),
      ],
      now,
      "UTC",
    );

    expect(picks).toEqual(["later", "earlier"]);
  });

  it("suggests the earlier due date first", () => {
    const urgent = { urgent: true, important: true, quadrant: "urgent-important" } as const;

    const ids = suggest(
      [
        createMockTask({ id: "later", ...urgent, dueDate: LATER }),
        createMockTask({ id: "earlier", ...urgent, dueDate: EARLIER }),
      ],
      // Both are overdue by then, so only their order decides.
      new Date("2026-10-25T12:00:00.000Z"),
      null,
      "UTC",
    );

    expect(ids).toEqual(["earlier", "later"]);
  });

  it("suggests the older undated task first", () => {
    const urgent = { urgent: true, important: true, quadrant: "urgent-important" } as const;

    const ids = suggest(
      [
        createMockTask({ id: "later", ...urgent, createdAt: LATER }),
        createMockTask({ id: "earlier", ...urgent, createdAt: EARLIER }),
      ],
      now,
      null,
      "UTC",
    );

    expect(ids).toEqual(["earlier", "later"]);
  });
});
