/**
 * Top three's two fields on the local model (tasks/spec-top-three.md sections 3.2,
 * 5, and 12.3): the schemas keep them, the normal edit path writes and clears
 * them, and a recurring spawn or a duplicate starts with neither.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import {
	archivedTaskRecordSchema,
	storedArchivedTaskRecordSchema,
	storedTaskRecordSchema,
	storedTrashedTaskRecordSchema,
	taskRecordSchema,
	trashedTaskRecordSchema,
} from "@/lib/schema";
import { duplicateTask, toggleCompleted, updateTask } from "@/lib/tasks";
import { createMockTask } from "@/tests/fixtures";

const PICK = { focusDate: "2026-11-07", focusRank: 2 };
const STORED = createMockTask({ id: "pick-1", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-01T10:00:00.000Z" });

beforeEach(async () => {
	const db = getDb();
	await Promise.all(db.tables.map((table) => table.clear()));
});

describe("the schemas keep a pick", () => {
	it.each([
		["taskRecordSchema", taskRecordSchema],
		["storedTaskRecordSchema", storedTaskRecordSchema],
		["archivedTaskRecordSchema", archivedTaskRecordSchema],
		["storedArchivedTaskRecordSchema", storedArchivedTaskRecordSchema],
		["trashedTaskRecordSchema", trashedTaskRecordSchema],
		["storedTrashedTaskRecordSchema", storedTrashedTaskRecordSchema],
	])("%s", (_name, schema) => {
		expect(schema.parse({ ...STORED, ...PICK })).toMatchObject(PICK);
	});
});

describe("a stored row with a bad pick still reads (spec section 3.5)", () => {
	it.each([
		["storedTaskRecordSchema", storedTaskRecordSchema],
		["storedArchivedTaskRecordSchema", storedArchivedTaskRecordSchema],
		["storedTrashedTaskRecordSchema", storedTrashedTaskRecordSchema],
	])("%s keeps the task and reads no pick", (_name, schema) => {
		const result = schema.safeParse({ ...STORED, focusDate: "2026-02-30", focusRank: 5 });

		expect(result.success).toBe(true);
		expect(result.data?.focusDate).toBeUndefined();
		expect(result.data?.focusRank).toBeUndefined();
	});
});

describe("the normal edit path writes and clears a pick", () => {
	beforeEach(async () => {
		await getDb().tasks.add(STORED);
	});

	it("Add to today writes both fields", async () => {
		await updateTask(STORED.id, PICK);

		await expect(getDb().tasks.get(STORED.id)).resolves.toMatchObject(PICK);
	});

	it("Remove from today clears both fields", async () => {
		await updateTask(STORED.id, PICK);

		await updateTask(STORED.id, { focusDate: undefined, focusRank: undefined });

		const row = await getDb().tasks.get(STORED.id);
		expect(row?.focusDate).toBeUndefined();
		expect(row?.focusRank).toBeUndefined();
	});

	it("an edit that doesn't mention the pick keeps it", async () => {
		await updateTask(STORED.id, PICK);

		await updateTask(STORED.id, { title: "Renamed" });

		await expect(getDb().tasks.get(STORED.id)).resolves.toMatchObject({ title: "Renamed", ...PICK });
	});

	it("a pick changes no other field", async () => {
		await updateTask(STORED.id, PICK);

		const { updatedAt: _updatedAt, focusDate: _date, focusRank: _rank, ...rest } = (await getDb().tasks.get(STORED.id))!;
		const { updatedAt: _storedAt, ...storedRest } = STORED;
		expect(rest).toEqual(storedRest);
	});

	it.each([0, 4, 1.5])("refuses rank %s", async (focusRank) => {
		await expect(updateTask(STORED.id, { focusDate: PICK.focusDate, focusRank })).rejects.toThrow(/focusRank/);
	});

	it.each([
		["a date alone", { focusDate: PICK.focusDate }],
		["a rank alone", { focusRank: 1 }],
	])("refuses half a pair: %s", async (_name, half) => {
		await expect(updateTask(STORED.id, half)).rejects.toThrow(/focus/);
	});

	it("moves a picked row's rank without restating the date", async () => {
		await updateTask(STORED.id, PICK);

		await updateTask(STORED.id, { focusRank: 3 });

		await expect(getDb().tasks.get(STORED.id)).resolves.toMatchObject({ focusDate: PICK.focusDate, focusRank: 3 });
	});

	it("refuses a date that isn't YYYY-MM-DD", async () => {
		await expect(updateTask(STORED.id, { focusDate: "2026-11-07T00:00:00.000Z", focusRank: 1 })).rejects.toThrow(/focusDate/);
	});
});

describe("new rows start with neither field", () => {
	it("a recurring spawn", async () => {
		await getDb().tasks.add({ ...STORED, ...PICK, recurrence: "daily", dueDate: "2026-11-07T15:00:00.000Z" });

		const { recurringInstance } = await toggleCompleted(STORED.id, true);

		expect(recurringInstance).not.toBeNull();
		expect(recurringInstance?.focusDate).toBeUndefined();
		expect(recurringInstance?.focusRank).toBeUndefined();
	});

	it("a duplicate", async () => {
		await getDb().tasks.add({ ...STORED, ...PICK });

		const copy = await duplicateTask(STORED.id);

		expect(copy.focusDate).toBeUndefined();
		expect(copy.focusRank).toBeUndefined();
	});
});
