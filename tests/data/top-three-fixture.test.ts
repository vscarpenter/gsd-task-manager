import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getDb } from "@/lib/db";
import { importPayloadSchema } from "@/lib/schema";
import { exportTasks, importTasks } from "@/lib/tasks";
import type { ImportablePayload } from "@/lib/types";

/**
 * The web half of the top three fixture contract (tasks/spec-top-three.md section 7).
 * `web-top-three-2.2.0.json` is a real Settings export from the running web build, and
 * iOS and Android keep byte-identical copies. md5 6da5aec65096d917c777e7a51a8d925e.
 */
const FIXTURE = join(__dirname, "..", "fixtures", "cross-platform", "web-top-three-2.2.0.json");

function topThreeBackup(): ImportablePayload {
	return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

beforeEach(async () => {
	const db = getDb();
	await db.delete();
	await db.open();
});

describe("top three fixture: web 2.2.0 export", () => {
	it("passes the import schema", () => {
		expect(importPayloadSchema.safeParse(topThreeBackup()).success).toBe(true);
	});

	it("restores each store's pick and leaves the unpicked task without one", async () => {
		await importTasks(topThreeBackup(), "replace");

		const db = getDb();
		await expect(db.tasks.get("xiDU_5CYf636")).resolves.toMatchObject({ focusDate: "2026-11-07", focusRank: 1 });
		await expect(db.tasks.get("p9oPwowyf0AD")).resolves.toMatchObject({ focusDate: "2026-11-07", focusRank: 2 });
		await expect(db.archivedTasks.get("038j6XMhM6_j")).resolves.toMatchObject({ focusDate: "2026-11-06", focusRank: 1 });
		await expect(db.deletedTasks.get("wo2IKQc1Bowt")).resolves.toMatchObject({ focusDate: "2026-11-07", focusRank: 3 });
		const unpicked = await db.tasks.get("VMU6izYEey7X");
		expect(unpicked?.focusDate).toBeUndefined();
		expect(unpicked?.focusRank).toBeUndefined();
	});

	it("re-exports the same picks under 2.2.0", async () => {
		await importTasks(topThreeBackup(), "replace");

		const reExported = await exportTasks();

		expect(reExported.version).toBe("2.2.0");
		const picks = (rows: Array<{ id: string; focusDate?: string; focusRank?: number }> = []) =>
			rows.filter((row) => row.focusDate).map((row) => [row.id, row.focusDate, row.focusRank]).sort();
		expect(picks(reExported.tasks)).toEqual(picks(topThreeBackup().tasks));
		expect(picks(reExported.archivedTasks)).toEqual(picks(topThreeBackup().archivedTasks));
		expect(picks(reExported.deletedTasks)).toEqual(picks(topThreeBackup().deletedTasks));
	});
});
