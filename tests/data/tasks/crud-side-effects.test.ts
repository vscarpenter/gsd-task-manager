import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { snoozeTask, clearSnooze } from "@/lib/tasks/crud/snooze";
import { startTimeTracking, stopTimeTracking } from "@/lib/tasks/crud/time-tracking";
import { createMockTask } from "@/tests/fixtures";

// Real fake-indexeddb integration tests (no db/helpers mocks). Migrated from the
// former function-coverage-final / last-function-push padding files (finding
// F2.1). The canonical snooze.test.ts and time-tracking.test.ts mock @/lib/db AND
// the crud helpers, so they never exercise getSyncContext / enqueueSyncOperation
// or the defensive `?? false` / `|| []` branches reached only by real execution.
describe("task crud side effects (real DB)", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.tasks.clear();
    await db.syncQueue.clear();
    await db.syncMetadata.clear();
  });

  describe("snoozeTask", () => {
    it("sets snoozedUntil and persists it for a positive duration", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "s1" }));

      const result = await snoozeTask("s1", 60);

      expect(result.snoozedUntil).toBeTruthy();
      const stored = await db.tasks.get("s1");
      expect(stored?.snoozedUntil).toBe(result.snoozedUntil);
    });

    it("clears snoozedUntil when minutes is 0", async () => {
      const db = getDb();
      await db.tasks.put(
        createMockTask({ id: "s2", snoozedUntil: new Date().toISOString() })
      );

      const result = await clearSnooze("s2");

      expect(result.snoozedUntil).toBeUndefined();
      const stored = await db.tasks.get("s2");
      expect(stored?.snoozedUntil).toBeUndefined();
    });
  });

  describe("time tracking", () => {
    it("starts a timer on a task that has no prior entries", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "t1" }));

      const result = await startTimeTracking("t1");

      expect(result.timeEntries).toHaveLength(1);
      expect(result.timeEntries![0].endedAt).toBeUndefined();
    });

    it("stops the running timer and computes timeSpent", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "t2" }));
      await startTimeTracking("t2");

      const result = await stopTimeTracking("t2", "wrote the report");

      expect(result.timeEntries![0].endedAt).toBeTruthy();
      expect(result.timeEntries![0].notes).toBe("wrote the report");
      // start and stop happen within the same tick -> rounds to 0 minutes
      expect(result.timeSpent).toBe(0);
    });

    it("throws when starting a timer that is already running", async () => {
      const db = getDb();
      await db.tasks.put(createMockTask({ id: "t3" }));
      await startTimeTracking("t3");

      await expect(startTimeTracking("t3")).rejects.toThrow(
        /already has a running timer/
      );
    });
  });
});
