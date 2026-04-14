/**
 * Reset Everything - Complete application reset utility
 *
 * Provides functions to clear all application data including:
 * - IndexedDB (tasks, settings, sync data)
 * - localStorage (PocketBase auth, PWA prompts)
 * - Session data (sync config)
 *
 * SECURITY: Preserves deviceId for potential future re-sync
 * WARNING: All data loss is permanent and cannot be undone
 */

import { getDb } from "@/lib/db";
import { disableSync, getSyncConfig } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";
import { SYNC_CONFIG } from "@/lib/constants/sync";

const logger = createLogger("DB");

/**
 * Options for reset operation
 */
export interface ResetOptions {
	preserveTheme?: boolean; // Keep user's theme preference
}

/**
 * Result of reset operation
 */
export interface ResetResult {
	success: boolean;
	clearedTables: string[];
	clearedLocalStorage: string[];
	errors: string[];
}

/**
 * Clear all IndexedDB tables except deviceId
 * Preserves deviceId for potential future sync re-registration
 */
async function clearIndexedDB(): Promise<{ tables: string[]; errors: string[] }> {
	const db = getDb();
	const cleared: string[] = [];
	const errors: string[] = [];

	try {
		const config = await getSyncConfig();
		const deviceId = config?.deviceId;

		// Clear standard tables in bulk
		const tablesToClear = [
			db.tasks, db.archivedTasks, db.notificationSettings,
			db.archiveSettings, db.syncQueue, db.syncHistory,
		] as const;
		for (const table of tablesToClear) {
			await table.clear();
			cleared.push(table.name);
		}

		// Clear only custom smart views (preserve built-in)
		const customViews = (await db.smartViews.toArray()).filter((v) => !v.isBuiltIn);
		await db.smartViews.bulkDelete(customViews.map((v) => v.id));
		cleared.push(`smartViews (${customViews.length} custom)`);

		// Clear sync metadata but preserve deviceId
		await db.syncMetadata.clear();
		if (deviceId) {
			await db.syncMetadata.add(buildPreservedSyncMetadata(deviceId));
		}
		cleared.push("syncMetadata");

		logger.info("IndexedDB cleared successfully", { clearedTables: cleared });
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		errors.push(`IndexedDB: ${errorMsg}`);
		logger.error("Failed to clear IndexedDB", err instanceof Error ? err : undefined, {
			errorMessage: errorMsg
		});
	}

	return { tables: cleared, errors };
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
		lastSuccessfulSyncAt: null,
		consecutiveFailures: 0,
		lastFailureAt: null,
		lastFailureReason: null,
		nextRetryAt: null,
		autoSyncEnabled: true,
		autoSyncIntervalMinutes: SYNC_CONFIG.DEFAULT_AUTO_SYNC_INTERVAL_MINUTES,
	};
}

/**
 * Clear localStorage items (except theme if preserveTheme=true)
 */
function clearLocalStorage(preserveTheme = false): { items: string[]; errors: string[] } {
	const cleared: string[] = [];
	const errors: string[] = [];

	try {
		const theme = preserveTheme ? localStorage.getItem("theme") : null;

		// Clear PocketBase auth data (stored by PB SDK)
		localStorage.removeItem("pocketbase_auth");
		cleared.push("pocketbase_auth");

		// Clear PWA prompt dismissal
		localStorage.removeItem("gsd-pwa-dismissed");
		cleared.push("gsd-pwa-dismissed");

		// Clear theme if not preserving
		if (!preserveTheme) {
			localStorage.removeItem("theme");
			cleared.push("theme");
		} else if (theme !== null) {
			// Restore theme
			localStorage.setItem("theme", theme);
		}

		logger.info("localStorage cleared successfully", {
			clearedItems: cleared,
			preservedTheme: preserveTheme,
		});
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		errors.push(`localStorage: ${errorMsg}`);
		logger.error("Failed to clear localStorage", err instanceof Error ? err : undefined, {
			errorMessage: errorMsg
		});
	}

	return { items: cleared, errors };
}

/**
 * Logout from sync and clear session data
 */
async function clearSessionData(): Promise<{ success: boolean; errors: string[] }> {
	const errors: string[] = [];

	try {
		await disableSync();
		logger.info("Sync disabled successfully");
		return { success: true, errors: [] };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		errors.push(`Sync logout: ${errorMsg}`);
		logger.error("Failed to disable sync", err instanceof Error ? err : undefined, {
			errorMessage: errorMsg
		});
		return { success: false, errors };
	}
}

/**
 * Reset everything - complete application reset
 *
 * Clears all data:
 * - All tasks (active and archived)
 * - All settings (notifications, archive)
 * - Custom smart views (built-in views preserved)
 * - Sync data (queue, history, metadata)
 * - PocketBase auth state
 * - PWA prompts
 *
 * Preserves:
 * - deviceId (for potential future sync)
 * - Theme (if preserveTheme=true)
 * - Built-in smart views
 *
 * @param options - Reset options
 * @returns Reset result with success status and details
 */
export async function resetEverything(
	options: ResetOptions = {}
): Promise<ResetResult> {
	logger.info("Starting complete reset", { options });

	const result: ResetResult = {
		success: true,
		clearedTables: [],
		clearedLocalStorage: [],
		errors: [],
	};

	// Step 1: Logout from sync
	const sessionResult = await clearSessionData();
	if (!sessionResult.success) {
		result.errors.push(...sessionResult.errors);
		result.success = false;
	}

	// Step 2: Clear IndexedDB
	const dbResult = await clearIndexedDB();
	result.clearedTables = dbResult.tables;
	if (dbResult.errors.length > 0) {
		result.errors.push(...dbResult.errors);
		result.success = false;
	}

	// Step 3: Clear localStorage
	const storageResult = clearLocalStorage(options.preserveTheme);
	result.clearedLocalStorage = storageResult.items;
	if (storageResult.errors.length > 0) {
		result.errors.push(...storageResult.errors);
		result.success = false;
	}

	logger.info("Reset complete", {
		success: result.success,
		clearedTables: result.clearedTables.length,
		clearedLocalStorage: result.clearedLocalStorage.length,
		errors: result.errors.length,
	});

	return result;
}

/**
 * Reload the page after reset to ensure clean state
 * WARNING: This will discard any unsaved changes
 */
export function reloadAfterReset(): void {
	logger.info("Reloading application after reset");

	if (typeof window !== "undefined") {
		window.location.href = "/";
	}
}
