import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { exportTasks, importTasks } from "@/lib/tasks";
import { importPayloadSchema } from "@/lib/schema";
import { getDb } from "@/lib/db";
import type { ImportablePayload } from "@/lib/types";

/**
 * The other half of the cross-platform backup contract.
 *
 * `ios-backup-export.json` is not hand-written — it is the literal output of the iOS
 * client's `TaskStore.exportJSON()`, produced from the web export in the same fixture
 * directory. Both suites read that shared pair, so neither can drift into passing against
 * a shape the other never writes.
 *
 * The original bug: the iOS client wrote `version` as the number 1, this schema demanded
 * `z.string()`, and the import was refused before a single task was read.
 */
const FIXTURES = join(__dirname, "..", "fixtures", "cross-platform");

function iosBackup(): ImportablePayload {
  return JSON.parse(readFileSync(join(FIXTURES, "ios-backup-export.json"), "utf8"));
}

function legacyIosBackup(): ImportablePayload {
  // What every iOS build through 2.2.0 wrote: tasks only, numeric version.
  return {
    version: 1,
    exportedAt: "2026-08-28T12:00:00.000Z",
    tasks: iosBackup().tasks,
  } as ImportablePayload;
}

describe("Cross-platform backup — iOS to web", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete();
    await db.open();
  });

  describe("the envelope the iOS client writes", () => {
    it("should_pass_the_import_schema", () => {
      const result = importPayloadSchema.safeParse(iosBackup());
      expect(result.success).toBe(true);
    });

    it("should_write_version_as_a_semver_string", () => {
      expect(iosBackup().version).toBe("2.1.0");
    });

    it("should_carry_every_user_owned_store", () => {
      const backup = iosBackup();
      expect(backup.tasks).toHaveLength(2);
      expect(backup.archivedTasks).toHaveLength(1);
      expect(backup.deletedTasks).toHaveLength(1);
      expect(backup.smartViews).toHaveLength(1);
      expect(backup.notificationSettings).toBeDefined();
      expect(backup.archiveSettings).toBeDefined();
      expect(backup.appPreferences).toBeDefined();
    });

    it("should_still_import_the_legacy_numeric_version_shape", async () => {
      const db = getDb();
      await importTasks(legacyIosBackup(), "replace");
      expect(await db.tasks.count()).toBe(2);
    });
  });

  describe("restoring it", () => {
    it("should_restore_every_store", async () => {
      const db = getDb();
      await importTasks(iosBackup(), "replace");

      expect(await db.tasks.count()).toBe(2);
      expect(await db.archivedTasks.count()).toBe(1);
      expect(await db.deletedTasks.count()).toBe(1);
      expect(await db.smartViews.count()).toBe(1);
      expect(await db.archiveSettings.get("settings")).toMatchObject({ archiveAfterDays: 60 });
      expect(await db.notificationSettings.get("settings")).toMatchObject({ defaultReminder: 120 });
    });

    it("should_preserve_task_detail", async () => {
      const db = getDb();
      await importTasks(iosBackup(), "replace");

      const task = await db.tasks.get("web-task-1");
      expect(task).toBeDefined();
      expect(task?.title).toBe("Ship the parity fixes");
      expect(task?.tags).toEqual(["work", "parity"]);
      expect(task?.subtasks).toHaveLength(2);
      expect(task?.recurrence).toBe("weekly");
      expect(task?.notifyBefore).toBe(30);
      expect(task?.estimatedMinutes).toBe(120);
      expect(task?.timeEntries).toHaveLength(1);

      const blocked = await db.tasks.get("web-task-2");
      expect(blocked?.dependencies).toEqual(["web-task-1"]);
    });

    it("should_keep_the_archived_row_out_of_the_active_table", async () => {
      const db = getDb();
      await importTasks(iosBackup(), "replace");
      expect(await db.tasks.get("web-arch-1")).toBeUndefined();
      expect(await db.archivedTasks.get("web-arch-1")).toBeDefined();
    });

    it("should_preserve_the_original_archivedAt_and_deletedAt_stamps", async () => {
      // Re-stamping would reset the archive's age and hand back a spent retention window.
      const db = getDb();
      await importTasks(iosBackup(), "replace");
      expect((await db.archivedTasks.get("web-arch-1"))?.archivedAt).toBe("2026-06-01T10:00:00.000Z");
      expect((await db.deletedTasks.get("web-trash-1"))?.deletedAt).toBe("2026-08-27T09:00:00.000Z");
    });

    it("should_restore_the_custom_smart_view_with_its_criteria", async () => {
      const db = getDb();
      await importTasks(iosBackup(), "replace");

      const view = await db.smartViews.get("custom-view-1");
      expect(view).toBeDefined();
      expect(view?.name).toBe("Overdue work");
      expect(view?.isBuiltIn).toBe(false);
      expect(view?.criteria).toMatchObject({
        status: "active",
        overdue: true,
        tags: ["work"],
        quadrants: ["urgent-important"],
        recurrence: ["weekly"],
      });
    });
  });

  describe("round trip", () => {
    it("should_survive_import_then_re_export_then_import", async () => {
      const db = getDb();
      await importTasks(iosBackup(), "replace");

      const reExported = await exportTasks();
      await db.delete();
      await db.open();
      await importTasks(reExported, "replace");

      expect(await db.tasks.count()).toBe(2);
      expect(await db.archivedTasks.count()).toBe(1);
      expect(await db.deletedTasks.count()).toBe(1);
      expect(await db.smartViews.count()).toBe(1);
    });

    it("should_re_export_a_payload_the_ios_client_could_read_back", async () => {
      await importTasks(iosBackup(), "replace");
      const reExported = await exportTasks();

      // The iOS decoder requires fractional-seconds ISO-8601 on every date it reads.
      expect(reExported.version).toBe("2.1.0");
      expect(reExported.exportedAt).toMatch(/\.\d{3}Z$/);
      for (const task of reExported.tasks) {
        expect(task.createdAt).toMatch(/\.\d{3}Z$/);
        expect(task.updatedAt).toMatch(/\.\d{3}Z$/);
        if (task.dueDate) expect(task.dueDate).toMatch(/\.\d{3}Z$/);
      }
      expect(reExported.archivedTasks?.[0].archivedAt).toMatch(/\.\d{3}Z$/);
      expect(reExported.deletedTasks?.[0].deletedAt).toMatch(/\.\d{3}Z$/);
    });
  });
});
