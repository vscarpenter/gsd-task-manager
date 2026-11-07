/**
 * Backup envelope 2.2.0 (tasks/spec-top-three.md section 7): live, archived,
 * and trashed rows carry the focus pair, an unset pair is left out, and an
 * invalid pair on import becomes neither field without costing the task.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { exportTasks, exportToJson, importFromJson } from "@/lib/tasks";
import type { TaskRecord } from "@/lib/types";
import { createMockTask } from "@/tests/fixtures";

const PICK = { focusDate: "2026-11-07", focusRank: 1 };
const EXPORTED_AT = "2026-11-07T12:00:00.000Z";

const live = (id: string, extra: Partial<TaskRecord> = {}): TaskRecord => createMockTask({ id, title: `Task ${id}`, ...extra });

beforeEach(async () => {
	const db = getDb();
	await Promise.all(db.tables.map((table) => table.clear()));
});

describe("envelope 2.2.0", () => {
	it("is the version this build writes", async () => {
		expect((await exportTasks()).version).toBe("2.2.0");
	});

	it("backup and restore keep a pick in every store", async () => {
		const db = getDb();
		await db.tasks.put(live("live-1", PICK));
		await db.archivedTasks.put({ ...live("arch-1", { ...PICK, completed: true }), archivedAt: EXPORTED_AT });
		await db.deletedTasks.put({ ...live("trash-1", PICK), deletedAt: EXPORTED_AT });
		const backup = await exportToJson();
		await Promise.all([db.tasks.clear(), db.archivedTasks.clear(), db.deletedTasks.clear()]);

		await importFromJson(backup, "replace");

		await expect(db.tasks.get("live-1")).resolves.toMatchObject(PICK);
		await expect(db.archivedTasks.get("arch-1")).resolves.toMatchObject(PICK);
		await expect(db.deletedTasks.get("trash-1")).resolves.toMatchObject(PICK);
	});

	it("leaves an unset pick out of the export", async () => {
		await getDb().tasks.put(live("live-1"));

		const backup = await exportToJson();

		expect(backup).not.toContain("focusDate");
		expect(backup).not.toContain("focusRank");
	});

	it.each([
		["a date that isn't real", { focusDate: "2026-02-30", focusRank: 2 }],
		["a rank past three", { focusDate: "2026-11-07", focusRank: 4 }],
		["half a pair", { focusDate: "2026-11-07" }],
		["a timestamp for a date", { focusDate: "2026-11-07T00:00:00.000Z", focusRank: 1 }],
	])("imports %s as no pick and keeps the task", async (_name, pair) => {
		const row = { ...live("bad-1"), ...pair };
		const raw = JSON.stringify({
			tasks: [row],
			archivedTasks: [{ ...live("bad-arch", { completed: true }), ...pair, archivedAt: EXPORTED_AT }],
			deletedTasks: [{ ...live("bad-trash"), ...pair, deletedAt: EXPORTED_AT }],
			exportedAt: EXPORTED_AT,
			version: "2.2.0",
		});

		await importFromJson(raw, "replace");

		const db = getDb();
		const rows = [await db.tasks.get("bad-1"), await db.archivedTasks.get("bad-arch"), await db.deletedTasks.get("bad-trash")];
		for (const stored of rows) {
			expect(stored).toBeDefined();
			expect(stored?.focusDate).toBeUndefined();
			expect(stored?.focusRank).toBeUndefined();
		}
	});
});
