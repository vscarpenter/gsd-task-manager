import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { getDb } from "@/lib/db";
import { useStorageSummary } from "@/components/settings-page/use-storage-summary";
import { createMockTask } from "@/tests/fixtures";

const live = [createMockTask({ id: "live-1" })];

async function resetStores(): Promise<void> {
  const db = getDb();
  await Promise.all([db.tasks.clear(), db.archivedTasks.clear(), db.deletedTasks.clear()]);
}

describe("useStorageSummary counts everything this device holds", () => {
  beforeEach(resetStores);

  it("counts a trashed task in the total, and in the Trash breakdown", async () => {
    await getDb().deletedTasks.put({ ...createMockTask({ id: "trashed-1" }), deletedAt: "2026-11-01T00:00:00.000Z" });

    const { result } = renderHook(() => useStorageSummary(live));

    await waitFor(() => expect(result.current.trashedTasks).toBe(1));
    expect(result.current.totalTasks).toBe(2);
  });

  it("adds the trashed rows to the size", async () => {
    const { result: without } = renderHook(() => useStorageSummary(live));
    await waitFor(() => expect(without.current.estimatedKb).not.toBeUndefined());
    const before = Number(without.current.estimatedKb);
    await getDb().deletedTasks.put({
      ...createMockTask({ id: "trashed-1", description: "x".repeat(2048) }),
      deletedAt: "2026-11-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useStorageSummary(live));

    await waitFor(() => expect(Number(result.current.estimatedKb)).toBeGreaterThan(before + 1.5));
  });

  it("keeps live, archived, and trashed together in one total", async () => {
    await getDb().archivedTasks.put({ ...createMockTask({ id: "arch-1" }), archivedAt: "2026-10-01T00:00:00.000Z" });
    await getDb().deletedTasks.put({ ...createMockTask({ id: "trash-1" }), deletedAt: "2026-11-01T00:00:00.000Z" });

    const { result } = renderHook(() => useStorageSummary(live));

    await waitFor(() => expect(result.current.totalTasks).toBe(3));
    expect(result.current.archivedTasks).toBe(1);
    expect(result.current.trashedTasks).toBe(1);
  });
});
