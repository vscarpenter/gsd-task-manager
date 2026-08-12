import { describe, expect, it, beforeEach } from "vitest";

import { exportTasks, importTasks } from "@/lib/tasks";
import { getDb } from "@/lib/db";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";

/**
 * Full-fidelity backup coverage (ADR 0014).
 *
 * Export is the only way data leaves this app, so a store missing from the
 * envelope is a store the user can never get back.
 */

function archived(id: string, archivedAt = "2026-01-01T00:00:00.000Z"): TaskRecord {
  return { ...createMockTask({ id, title: `Archived ${id}`, completed: true }), archivedAt };
}

async function seedEveryStore() {
  const db = getDb();
  await db.tasks.bulkPut([
    createMockTask({ id: "live-1", title: "Live one" }),
    createMockTask({ id: "live-2", title: "Live two" }),
  ]);
  await db.archivedTasks.bulkPut([archived("arch-1"), archived("arch-2"), archived("arch-3")]);
  await db.smartViews.put({
    id: "custom-1",
    name: "My view",
    criteria: { status: "active" },
    isBuiltIn: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await db.notificationSettings.put({
    id: "settings",
    enabled: true,
    defaultReminder: 45,
    soundEnabled: false,
    permissionAsked: true,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await db.archiveSettings.put({ id: "settings", enabled: true, archiveAfterDays: 60 });
  await db.appPreferences.put({
    id: "preferences",
    pinnedSmartViewIds: ["custom-1"],
    maxPinnedViews: 5,
    smartViewsEnabled: true,
  });
}

async function clearEveryStore() {
  const db = getDb();
  await Promise.all([
    db.tasks.clear(),
    db.archivedTasks.clear(),
    db.smartViews.clear(),
    db.notificationSettings.clear(),
    db.archiveSettings.clear(),
    db.appPreferences.clear(),
    db.syncQueue.clear(),
  ]);
}

describe("Backup envelope", () => {
  beforeEach(async () => {
    await getDb();
    await clearEveryStore();
  });

  describe("export", () => {
    it("should_include_archived_tasks_with_archivedAt", async () => {
      await seedEveryStore();
      const payload = await exportTasks();

      expect(payload.archivedTasks).toHaveLength(3);
      // taskRecordSchema is .strict() and declares no archivedAt — validating
      // archived rows with it would drop every one of them.
      expect(payload.archivedTasks?.[0]?.archivedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("should_include_smart_views_and_settings", async () => {
      await seedEveryStore();
      const payload = await exportTasks();

      expect(payload.smartViews).toHaveLength(1);
      expect(payload.notificationSettings?.defaultReminder).toBe(45);
      expect(payload.archiveSettings?.archiveAfterDays).toBe(60);
      expect(payload.appPreferences?.smartViewsEnabled).toBe(true);
    });

    it("should_announce_the_new_envelope_version", async () => {
      await seedEveryStore();
      expect((await exportTasks()).version).toBe("2.0.0");
    });

    it("should_never_include_device_local_or_account_stores", async () => {
      await seedEveryStore();
      const serialized = JSON.stringify(await exportTasks());

      // syncMetadata carries email / userId / deviceId. A backup is a file people
      // email themselves; it must not bind that file to an account.
      for (const forbidden of ["syncMetadata", "syncQueue", "deviceInfo", "syncHistory"]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it("should_emit_empty_arrays_rather_than_missing_keys", async () => {
      const payload = await exportTasks();
      expect(payload.tasks).toEqual([]);
      expect(payload.archivedTasks).toEqual([]);
      expect(payload.smartViews).toEqual([]);
    });
  });

  describe("import — 1.0.0 compatibility", () => {
    it("should_import_tasks_from_a_1_0_0_payload", async () => {
      const db = getDb();
      await importTasks(
        {
          version: "1.0.0",
          exportedAt: "2026-01-01T00:00:00.000Z",
          tasks: [createMockTask({ id: "legacy-1", title: "Legacy task" })],
        },
        "replace"
      );

      expect(await db.tasks.count()).toBe(1);
    });

    it("should_leave_other_stores_untouched_for_a_1_0_0_payload", async () => {
      const db = getDb();
      await seedEveryStore();

      await importTasks(
        {
          version: "1.0.0",
          exportedAt: "2026-01-01T00:00:00.000Z",
          tasks: [createMockTask({ id: "legacy-1", title: "Legacy task" })],
        },
        "replace"
      );

      // A v1 backup says nothing about the archive, so replace must not read
      // that silence as "delete it".
      expect(await db.archivedTasks.count()).toBe(3);
      expect(await db.archiveSettings.get("settings")).toBeDefined();
    });
  });

  describe("import — replace", () => {
    it("should_restore_every_store", async () => {
      const db = getDb();
      await seedEveryStore();
      const backup = await exportTasks();

      await clearEveryStore();
      await importTasks(backup, "replace");

      expect(await db.tasks.count()).toBe(2);
      expect(await db.archivedTasks.count()).toBe(3);
      expect(await db.smartViews.count()).toBe(1);
      expect((await db.notificationSettings.get("settings"))?.defaultReminder).toBe(45);
      expect((await db.archiveSettings.get("settings"))?.archiveAfterDays).toBe(60);
      expect((await db.appPreferences.get("preferences"))?.maxPinnedViews).toBe(5);
    });

    it("should_preserve_archivedAt_through_a_round_trip", async () => {
      const db = getDb();
      await seedEveryStore();
      const backup = await exportTasks();

      await clearEveryStore();
      await importTasks(backup, "replace");

      expect((await db.archivedTasks.get("arch-1"))?.archivedAt).toBe(
        "2026-01-01T00:00:00.000Z"
      );
    });

    it("should_drop_the_archived_duplicate_when_an_id_is_also_live", async () => {
      const db = getDb();

      // Self-contradictory payload: ADR 0013 rule 1 says an id lives in one
      // table or the other, never both.
      await importTasks(
        {
          version: "2.0.0",
          exportedAt: "2026-01-01T00:00:00.000Z",
          tasks: [createMockTask({ id: "shared", title: "Live wins" })],
          archivedTasks: [archived("shared")],
        },
        "replace"
      );

      expect(await db.tasks.get("shared")).toBeDefined();
      expect(await db.archivedTasks.get("shared")).toBeUndefined();
    });
  });

  describe("import — merge", () => {
    it("should_add_archived_only_when_the_id_is_absent_from_both_tables", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "already-live", title: "Existing live" }));
      await db.archivedTasks.put(archived("already-archived"));

      await importTasks(
        {
          version: "2.0.0",
          exportedAt: "2026-01-01T00:00:00.000Z",
          tasks: [],
          archivedTasks: [archived("already-live"), archived("already-archived"), archived("fresh")],
        },
        "merge"
      );

      expect(await db.archivedTasks.get("fresh")).toBeDefined();
      // Would have resurrected a tombstone over live data.
      expect(await db.archivedTasks.get("already-live")).toBeUndefined();
      expect(await db.tasks.get("already-live")).toBeDefined();
      expect(await db.archivedTasks.count()).toBe(2);
    });

    it("should_not_overwrite_local_settings", async () => {
      const db = getDb();
      await seedEveryStore();

      await importTasks(
        {
          version: "2.0.0",
          exportedAt: "2026-01-01T00:00:00.000Z",
          tasks: [],
          archiveSettings: { id: "settings", enabled: false, archiveAfterDays: 30 },
        },
        "merge"
      );

      // Merge combines task lists; it does not adopt another device's config.
      expect((await db.archiveSettings.get("settings"))?.archiveAfterDays).toBe(60);
    });
  });
});
