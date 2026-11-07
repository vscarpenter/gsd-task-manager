import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { addToToday, movePick, removeFromToday, reorderPicks, tidyPicks } from "@/lib/tasks/top-three-actions";
import { createMockTask } from "@/tests/fixtures";

const ZONE = "America/Chicago";
const NOW = new Date("2026-11-08T16:00:00.000Z"); // Sunday 10:00 in Chicago
const TODAY = "2026-11-08";

async function seed(...tasks: Parameters<typeof createMockTask>[0][]): Promise<void> {
  const db = getDb();
  await db.tasks.clear();
  await db.syncQueue.clear();
  await db.tasks.bulkPut(tasks.map((t) => createMockTask(t)));
}

async function all() {
  return getDb().tasks.toArray();
}

describe("top three writes (spec section 3.2)", () => {
  beforeEach(async () => {
    await seed({ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" });
  });

  it("add to today picks the lowest free rank and bumps updatedAt", async () => {
    const before = (await getDb().tasks.get("a"))!.updatedAt;

    const result = await addToToday("a", await all(), NOW, ZONE);

    const row = await getDb().tasks.get("a");
    expect(result).toBe("added");
    expect(row).toMatchObject({ focusDate: TODAY, focusRank: 1 });
    expect(row!.updatedAt >= before).toBe(true);
  });

  it("add to today leaves every other field alone", async () => {
    const original = (await getDb().tasks.get("a"))!;

    await addToToday("a", await all(), NOW, ZONE);

    const { focusDate: _d, focusRank: _r, updatedAt: _u, ...rest } = (await getDb().tasks.get("a"))!;
    const { updatedAt: _ou, ...expected } = original;
    expect(rest).toEqual(expected);
  });

  it("add to today is refused when today is full", async () => {
    await seed(
      { id: "a", focusDate: TODAY, focusRank: 1 },
      { id: "b", focusDate: TODAY, focusRank: 2 },
      { id: "c", focusDate: TODAY, focusRank: 3 },
      { id: "d" }
    );

    const result = await addToToday("d", await all(), NOW, ZONE);

    expect(result).toBe("full");
    expect((await getDb().tasks.get("d"))?.focusDate).toBeUndefined();
  });

  it("remove from today clears both fields", async () => {
    await seed({ id: "a", focusDate: TODAY, focusRank: 2 });

    await removeFromToday("a");

    const row = await getDb().tasks.get("a");
    expect(row?.focusDate).toBeUndefined();
    expect(row?.focusRank).toBeUndefined();
  });

  it("move down swaps the two ranks", async () => {
    await seed(
      { id: "a", focusDate: TODAY, focusRank: 1 },
      { id: "b", focusDate: TODAY, focusRank: 2 },
      { id: "c" }
    );

    await movePick("a", "down", await all(), NOW, ZONE);

    expect((await getDb().tasks.get("a"))?.focusRank).toBe(2);
    expect((await getDb().tasks.get("b"))?.focusRank).toBe(1);
  });

  it("moving the first pick up does nothing", async () => {
    await seed({ id: "a", focusDate: TODAY, focusRank: 1 }, { id: "b", focusDate: TODAY, focusRank: 2 });
    const before = (await getDb().tasks.get("a"))!.updatedAt;

    await movePick("a", "up", await all(), NOW, ZONE);

    expect((await getDb().tasks.get("a"))?.updatedAt).toBe(before);
  });

  it("a drag reorder writes ranks 1 to 3 in the new order and skips rows already right", async () => {
    await seed(
      { id: "a", focusDate: TODAY, focusRank: 1 },
      { id: "b", focusDate: TODAY, focusRank: 2 },
      { id: "c", focusDate: TODAY, focusRank: 3 }
    );
    const untouched = (await getDb().tasks.get("a"))!.updatedAt;

    await reorderPicks(["a", "c", "b"], await all(), NOW, ZONE);

    expect((await getDb().tasks.get("c"))?.focusRank).toBe(2);
    expect((await getDb().tasks.get("b"))?.focusRank).toBe(3);
    expect((await getDb().tasks.get("a"))?.updatedAt).toBe(untouched);
  });

  it("tidy gives the first three ranks 1 to 3 and clears the overflow", async () => {
    await seed(
      { id: "a", focusDate: TODAY, focusRank: 1, updatedAt: "2026-11-08T10:00:00.000Z" },
      { id: "b", focusDate: TODAY, focusRank: 1, updatedAt: "2026-11-08T09:00:00.000Z" },
      { id: "c", focusDate: TODAY, focusRank: 2, updatedAt: "2026-11-08T08:00:00.000Z" },
      { id: "d", focusDate: TODAY, focusRank: 3, updatedAt: "2026-11-08T07:00:00.000Z" }
    );

    await tidyPicks(await all(), NOW, ZONE);

    const rows = new Map((await all()).map((t) => [t.id, t]));
    expect([rows.get("a")?.focusRank, rows.get("b")?.focusRank, rows.get("c")?.focusRank]).toEqual([1, 2, 3]);
    expect(rows.get("d")?.focusDate).toBeUndefined();
  });

  it("every write goes through the normal edit path and queues a push when sync is on", async () => {
    await getDb().syncMetadata.put({
      key: "sync_config", enabled: true, userId: "u", deviceId: "d", deviceName: "n", email: "e",
      provider: "p", lastSyncAt: null, lastSuccessfulSyncAt: null, consecutiveFailures: 0,
      lastFailureAt: null, lastFailureReason: null, nextRetryAt: null,
    });

    await addToToday("a", await all(), NOW, ZONE);

    expect(await getDb().syncQueue.count()).toBe(1);
  });
});
