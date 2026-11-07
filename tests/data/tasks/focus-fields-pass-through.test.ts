import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { updateTask } from "@/lib/tasks";
import { useTasksSchemaProbe } from "./focus-schema-probe";
import { createMockTask } from "@/tests/fixtures";

describe("focus fields pass through the edit path", () => {
  beforeEach(async () => {
    await getDb().tasks.clear();
    await getDb().tasks.put(createMockTask({ id: "t1" }));
  });

  it("an edit can set a pick", async () => {
    const saved = await updateTask("t1", { focusDate: "2026-11-08", focusRank: 2 });

    expect(saved).toMatchObject({ focusDate: "2026-11-08", focusRank: 2 });
    expect(await getDb().tasks.get("t1")).toMatchObject({ focusDate: "2026-11-08", focusRank: 2 });
  });

  it("an edit that leaves the pick out keeps it", async () => {
    await updateTask("t1", { focusDate: "2026-11-08", focusRank: 1 });

    const saved = await updateTask("t1", { title: "Renamed" });

    expect(saved).toMatchObject({ focusDate: "2026-11-08", focusRank: 1 });
  });

  it("an edit can clear a pick", async () => {
    await updateTask("t1", { focusDate: "2026-11-08", focusRank: 1 });

    const saved = await updateTask("t1", { focusDate: undefined, focusRank: undefined });

    expect(saved.focusDate).toBeUndefined();
    expect(saved.focusRank).toBeUndefined();
  });

  it("a stored pick survives the read-side schema", () => {
    expect(useTasksSchemaProbe({ focusDate: "2026-11-08", focusRank: 3 })).toMatchObject({
      focusDate: "2026-11-08",
      focusRank: 3,
    });
  });
});
