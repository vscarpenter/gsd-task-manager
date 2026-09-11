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

import { disableSync } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";
import { resetFeedbackState } from "@/lib/feedback/feedback-store";
import { wipeLocalData } from "@/lib/reset-local-data";

const logger = createLogger("DB");

/**
 * Options for reset operation
 */
export interface ResetOptions {
	preserveTheme?: boolean; // Keep user's theme preference
}

/** A reset step that can fail on its own. */
export type ResetStep = "sync-sign-out" | "local-data" | "browser-storage";

/**
 * Result of reset operation
 */
export interface ResetResult {
	success: boolean;
	clearedTables: string[];
	clearedLocalStorage: string[];
	errors: string[];
	/**
	 * Steps that threw, in the order they ran. Only "local-data" decides whether
	 * tasks survived, because that step fails only when neither the IndexedDB
	 * clear nor the database delete fallback removed them.
	 */
	failedSteps: ResetStep[];
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
		failedSteps: [],
	};

	// Step 1: Logout from sync
	const sessionResult = await clearSessionData();
	if (!sessionResult.success) {
		result.errors.push(...sessionResult.errors);
		result.failedSteps.push("sync-sign-out");
	}

	// Step 2: Clear IndexedDB, deleting the whole database if the clear is not verified
	const dbResult = await wipeLocalData();
	result.clearedTables = dbResult.tables;
	if (dbResult.errors.length > 0) {
		result.errors.push(...dbResult.errors);
		result.failedSteps.push("local-data");
	}

	// Step 3: Clear localStorage
	const storageResult = clearLocalStorage(options.preserveTheme);
	result.clearedLocalStorage = storageResult.items;
	if (storageResult.errors.length > 0) {
		result.errors.push(...storageResult.errors);
		result.failedSteps.push("browser-storage");
	}

	result.success = result.failedSteps.length === 0;

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
