import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { getDb } from "@/lib/db";
import { useTasks } from "@/lib/use-tasks";
import { createMockTask } from "@/tests/fixtures";

beforeEach(async () => { await getDb().tasks.clear(); });
describe("saved and active queries", () => {
  it("excludes saved items from active buckets but retains them for search and dependencies", async () => {
    await getDb().tasks.bulkPut([
      createMockTask({ id: "active-task" }),
      createMockTask({ id: "saved-old", savedAt: "2026-10-25T12:00:00.000Z" }),
      createMockTask({ id: "saved-new", savedAt: "2026-10-26T12:00:00.000Z" }),
    ]);
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all.map((t) => t.id)).toEqual(["active-task"]);
    expect(Object.values(result.current.byQuadrant).flat()).toHaveLength(1);
    expect(result.current.stored).toHaveLength(3);
    expect(result.current.saved.map((t) => t.id)).toEqual(["saved-new", "saved-old"]);
  });
});
