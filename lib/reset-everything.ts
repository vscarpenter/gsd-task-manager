/**
 * Reset Everything - Complete application reset utility
 *
 * Provides functions to clear all application data including:
 * - IndexedDB (tasks, settings, sync data)
 * - localStorage (OAuth state, PWA prompts)
 * - Session data (sync tokens, crypto keys)
 *
 * SECURITY: Preserves deviceId for potential future re-sync
 * WARNING: All data loss is permanent and cannot be undone
 */

import { getDb } from "@/lib/db";
import { disableSync, getSyncConfig } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";

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
		// Save deviceId before clearing
		const config = await getSyncConfig();
		const deviceId = config?.deviceId;

		// Clear all task data
		await db.tasks.clear();
		cleared.push("tasks");

		await db.archivedTasks.clear();
		cleared.push("archivedTasks");

		// Clear settings tables
		await db.notificationSettings.clear();
		cleared.push("notificationSettings");

		await db.archiveSettings.clear();
		cleared.push("archiveSettings");

		// Clear smart views (only custom ones)
		const allViews = await db.smartViews.toArray();
		const customViews = allViews.filter((v) => !v.isBuiltIn);
		for (const view of customViews) {
			await db.smartViews.delete(view.id);
		}
		cleared.push(`smartViews (${customViews.length} custom)`);

		// Clear sync-related tables
		await db.syncQueue.clear();
		cleared.push("syncQueue");

		await db.syncHistory.clear();
		cleared.push("syncHistory");

		// Clear sync metadata but preserve deviceId
		await db.syncMetadata.clear();
		if (deviceId) {
			await db.syncMetadata.add({
				key: "sync_config",
				enabled: false,
				userId: null,
				deviceId, // Preserve for future sync
				deviceName: "Device",
				email: null,
				token: null,
				tokenExpiresAt: null,
				lastSyncAt: null,
				vectorClock: {},
				conflictStrategy: "last_write_wins",
				serverUrl: "",
				consecutiveFailures: 0,
				lastFailureAt: null,
				lastFailureReason: null,
				nextRetryAt: null,
			});
		}
		cleared.push("syncMetadata");

		logger.info("IndexedDB cleared successfully", {
			clearedTables: cleared,
		});
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		errors.push(`IndexedDB: ${errorMsg}`);
		logger.error("Failed to clear IndexedDB", err instanceof Error ? err : undefined, {
			errorMessage: errorMsg
		});
	}

	return { tables: cleared, errors };
}

/**
 * Clear localStorage items (except theme if preserveTheme=true)
 */
function clearLocalStorage(preserveTheme = false): { items: string[]; errors: string[] } {
	const cleared: string[] = [];
	const errors: string[] = [];

	try {
		const theme = preserveTheme ? localStorage.getItem("theme") : null;

		// Clear OAuth handshake data
		localStorage.removeItem("oauth_handshake_result");
		cleared.push("oauth_handshake_result");

		localStorage.removeItem("oauth_handshake_state");
		cleared.push("oauth_handshake_state");

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
 * - OAuth state
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
