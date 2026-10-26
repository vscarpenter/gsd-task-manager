import Dexie from "dexie";
import { expect, it } from "vitest";
import { registerDatabaseVersions } from "@/lib/db-migrations";
import { createMockTask } from "@/tests/fixtures";

it("upgrades existing tasks without placing them in Saved or losing their details", async () => {
  const name = "SavedMigrationTest";
  await Dexie.delete(name);
  const previous = new Dexie(name);
  previous.version(16).stores({ tasks: "id" });
  const task = createMockTask({ id: "legacy-reading", description: "https://example.com Keep this" });
  await previous.table("tasks").put(task);
  previous.close();
  const upgraded = new Dexie(name);
  registerDatabaseVersions(upgraded);
  try {
    await upgraded.open();
    expect(await upgraded.table("tasks").get(task.id)).toEqual(task);
    expect(upgraded.table("tasks").schema.indexes.map((index) => index.name)).toContain("savedAt");
  } finally {
    upgraded.close();
    await Dexie.delete(name);
  }
});
