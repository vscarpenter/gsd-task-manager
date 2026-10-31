import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { exportTasks, importTasks } from "@/lib/tasks";
import { importPayloadSchema } from "@/lib/schema";
import { getDb } from "@/lib/db";
import type { ImportablePayload } from "@/lib/types";

/**
 * The web half of the Saved fixture contract. `web-saved-14.2.0.json` is the byte-identical
 * copy of the export the web client wrote for a saved task. Android (SavedBackupFixtureTest.kt)
 * and iOS already read this file. These tests keep the web import and export honest about it.
 */
const FIXTURES = join(__dirname, "..", "fixtures", "cross-platform");
const SAVED_TASK_ID = "fkXzSdXIafQr";
const SAVED_AT = "2026-10-26T12:00:00.000Z";

function savedBackup(): ImportablePayload {
  return JSON.parse(readFileSync(join(FIXTURES, "web-saved-14.2.0.json"), "utf8"));
}

describe("Saved fixture — web 14.2.0 export", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete();
    await db.open();
  });

  it("should_pass_the_import_schema", () => {
    const result = importPayloadSchema.safeParse(savedBackup());
    expect(result.success).toBe(true);
  });

  it("should_carry_exactly_one_saved_task_with_its_savedAt_and_description", () => {
    const tasks = savedBackup().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(SAVED_TASK_ID);
    expect(tasks[0].savedAt).toBe(SAVED_AT);
    expect(tasks[0].description?.startsWith("Read when this project becomes active.")).toBe(true);
  });

  it("should_keep_savedAt_through_an_import_and_export", async () => {
    await importTasks(savedBackup(), "replace");
    const exported = await exportTasks();
    const saved = exported.tasks.find((task) => task.id === SAVED_TASK_ID);
    expect(saved?.savedAt).toBe(SAVED_AT);
  });
});
