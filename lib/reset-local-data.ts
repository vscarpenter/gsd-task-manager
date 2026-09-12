/**
 * The local data step of Reset Everything. It clears every IndexedDB table,
 * checks that nothing survived, and deletes the whole database when that check
 * fails, so a reset never reports success while tasks remain in the browser.
 */

import Dexie from "dexie";
import { getDb } from "@/lib/db";
import { getSyncConfig } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";
import { SYNC_CONFIG } from "@/lib/constants/sync";
import type { DeviceInfo, PBSyncConfig } from "@/lib/sync/types";

const logger = createLogger("DB");

type GsdDatabase = ReturnType<typeof getDb>;

export interface LocalDataWipeResult {
	tables: string[];
	errors: string[];
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Unknown error";
}

/** Build a minimal sync metadata record that preserves deviceId */
function buildPreservedSyncMetadata(deviceId: string) {
	return {
		key: "sync_config" as const,
		enabled: false,
		userId: null,
		deviceId,
		deviceName: "Device",
		email: null,
		provider: null,
		lastSyncAt: null,
		lastClientUpdatedAt: null,
		pullCursorVersion: 2 as const,
		lastServerUpdatedAt: null,
		lastSuccessfulSyncAt: null,
		consecutiveFailures: 0,
		lastFailureAt: null,
		lastFailureReason: null,
		nextRetryAt: null,
		autoSyncEnabled: true,
		autoSyncIntervalMinutes: SYNC_CONFIG.DEFAULT_AUTO_SYNC_INTERVAL_MINUTES,
		localTaskOwnerUserId: null,
	};
}

/** Clear every table in one transaction, keeping deviceId for a future sync. */
async function clearTables(db: GsdDatabase, cleared: string[]): Promise<void> {
	const config = await getSyncConfig();
	const deviceId = config?.deviceId;

	const allTables = [...db.tables];
	await db.transaction("rw", allTables, async () => {
		for (const table of allTables) {
			// react-doctor-disable-next-line react-doctor/async-await-in-loop -- one transaction must fail atomically
			await table.clear();
			cleared.push(table.name);
		}
		if (deviceId) {
			await db.syncMetadata.add(buildPreservedSyncMetadata(deviceId));
		}
	});
}

function isPreservedSyncConfig(row: PBSyncConfig | DeviceInfo): boolean {
	return row.key === "sync_config" && row.userId === null;
}

/** Name every table that still holds data, apart from the preserved sync_config row. */
async function findSurvivingTables(db: GsdDatabase): Promise<string[]> {
	return db.transaction("r", db.tables, async () => {
		const userTables = db.tables.filter((table) => table.name !== "syncMetadata");
		const counts = await Promise.all(userTables.map((table) => table.count()));
		const survivors = userTables.filter((_, index) => counts[index] > 0).map((table) => table.name);
		const metadata = await db.syncMetadata.toArray();
		return metadata.every(isPreservedSyncConfig) ? survivors : [...survivors, "syncMetadata"];
	});
}

/** Why the clear cannot be trusted, or null when every table is empty. */
async function findWipeProblem(db: GsdDatabase, cleared: string[]): Promise<string | null> {
	try {
		await clearTables(db, cleared);
		const survivors = await findSurvivingTables(db);
		return survivors.length > 0 ? `rows survived in ${survivors.join(", ")}` : null;
	} catch (err) {
		logger.error("Failed to clear IndexedDB", err instanceof Error ? err : undefined, {
			errorMessage: errorMessage(err),
		});
		return errorMessage(err);
	}
}

/**
 * Dexie leaves a blocked delete pending until the other connection closes, which
 * could hang reset forever. Fail instead, so the lock screen can offer a retry.
 */
function deleteUnlessBlocked(db: GsdDatabase): Promise<void> {
	return new Promise((resolve, reject) => {
		const onBlocked = () => reject(new Error("another open tab is blocking it"));
		db.on("blocked", onBlocked);
		// Keep auto-open, so this document can read an empty database without a reload.
		db.delete({ disableAutoOpen: false })
			.then(resolve, reject)
			.finally(() => db.on("blocked").unsubscribe(onBlocked));
	});
}

async function deleteDatabase(db: GsdDatabase): Promise<void> {
	await deleteUnlessBlocked(db);
	if (await Dexie.exists(db.name)) {
		throw new Error("the database still exists after delete");
	}
}

/**
 * Clear local data and prove it is gone. The step fails only when both the
 * clear and the database delete fail, and then errors name both.
 */
export async function wipeLocalData(): Promise<LocalDataWipeResult> {
	const db = getDb();
	const cleared: string[] = [];
	const problem = await findWipeProblem(db, cleared);
	if (problem === null) {
		logger.info("IndexedDB cleared successfully", { clearedTables: cleared });
		return { tables: cleared, errors: [] };
	}

	logger.warn("Deleting IndexedDB after an unverified clear", { errorMessage: problem });
	try {
		await deleteDatabase(db);
		return { tables: db.tables.map((table) => table.name), errors: [] };
	} catch (err) {
		logger.error("Failed to delete IndexedDB", err instanceof Error ? err : undefined, {
			errorMessage: errorMessage(err),
		});
		return { tables: cleared, errors: [`IndexedDB: ${problem}`, `IndexedDB delete: ${errorMessage(err)}`] };
	}
}
