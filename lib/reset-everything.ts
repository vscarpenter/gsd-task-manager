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
import { resetFeedbackState } from "@/lib/feedback/feedback-store";

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

function shouldSkipLocalStorageKey(key: string, preserveTheme: boolean): boolean {
	const isAppOwned =
		key === "pocketbase_auth" ||
		key === "theme" ||
		key.startsWith("gsd-") ||
		key.startsWith("gsd:");
	return !isAppOwned || (preserveTheme && key === "gsd-theme");
}

function clearFeedbackFallback(errors: string[]): void {
	try {
		resetFeedbackState();
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		errors.push(`feedback state: ${errorMsg}`);
		logger.error("Failed to clear feedback state", err instanceof Error ? err : undefined, {
			errorMessage: errorMsg,
		});
	}
}

/**
 * Clear localStorage items (except theme if preserveTheme=true)
 */
function clearLocalStorage(preserveTheme = false): { items: string[]; errors: string[] } {
	const cleared: string[] = [];
	const errors: string[] = [];

	try {
		const knownKeys = ["pocketbase_auth", "theme", "gsd-theme"];
		const storedKeys = Array.from(
			{ length: localStorage.length },
			(_, index) => localStorage.key(index),
		).filter((key): key is string => key !== null);
		const keys = [...new Set([...knownKeys, ...storedKeys])];

		for (const key of keys) {
			if (shouldSkipLocalStorageKey(key, preserveTheme)) continue;

			try {
				localStorage.removeItem(key);
				cleared.push(key);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Unknown error";
				errors.push(`localStorage ${key}: ${message}`);
			}
		}

		logger.info("localStorage cleared successfully", {
			clearedItems: cleared,
			preservedTheme: preserveTheme,
		});
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		errors.push(`localStorage enumeration: ${errorMsg}`);
		logger.error("Failed to clear localStorage", err instanceof Error ? err : undefined, {
			errorMessage: errorMsg
		});
	}
	clearFeedbackFallback(errors);

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
		// Reset must recreate the document so no in-memory store survives.
		// eslint-disable-next-line @next/next/no-location-assign-relative-destination
		window.location.href = "/";
	}
}
