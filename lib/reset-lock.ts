/**
 * Reset lock: a localStorage marker that keeps GSD locked while Reset
 * Everything runs, and after a run that could not prove local data is gone.
 * Components read it through useSyncExternalStore.
 */

export const RESET_PENDING_KEY = "gsd-reset-pending";

export type ResetLockState = "unlocked" | "running" | "locked";

const listeners = new Set<() => void>();
let running = false;
// Mirrors the stored marker, so this document stays locked when localStorage throws.
let markerMirror: string | null = null;

function readStoredMarker(): string | null {
	try {
		return window.localStorage.getItem(RESET_PENDING_KEY);
	} catch {
		// An unreadable store counts as no marker, so a browser with storage
		// disabled never locks for good. The mirror still covers this document.
		return null;
	}
}

function writeStoredMarker(marker: string): void {
	try {
		window.localStorage.setItem(RESET_PENDING_KEY, marker);
	} catch {
		// The mirror keeps this document locked. The lock cannot survive a reload.
	}
}

function removeStoredMarker(): void {
	try {
		window.localStorage.removeItem(RESET_PENDING_KEY);
	} catch {
		// Storage that throws holds no marker to remove.
	}
}

function notifyListeners(): void {
	listeners.forEach((listener) => listener());
}

/** Lock the app before a reset touches anything, and remember the theme choice for a retry. */
export function startResetLock(preserveTheme: boolean): void {
	markerMirror = JSON.stringify({ preserveTheme });
	running = true;
	writeStoredMarker(markerMirror);
	notifyListeners();
}

/** Unlock only when local data is gone. Otherwise stay locked until a retry succeeds. */
export function endResetLock(localDataDeleted: boolean): void {
	running = false;
	if (localDataDeleted) {
		markerMirror = null;
		removeStoredMarker();
	} else if (markerMirror !== null && readStoredMarker() === null) {
		// Another tab's successful retry may have removed the marker during this run.
		writeStoredMarker(markerMirror);
	}
	notifyListeners();
}

export function subscribeToResetLock(onChange: () => void): () => void {
	const handleStorage = (event: StorageEvent) => {
		if (event.key === RESET_PENDING_KEY) onChange();
	};
	listeners.add(onChange);
	window.addEventListener("storage", handleStorage);
	return () => {
		listeners.delete(onChange);
		window.removeEventListener("storage", handleStorage);
	};
}

export function getResetLockSnapshot(): ResetLockState {
	if (running) return "running";
	return markerMirror !== null || readStoredMarker() !== null ? "locked" : "unlocked";
}

/** The static export prerenders without storage, so the server never locks. */
export function getResetLockServerSnapshot(): ResetLockState {
	return "unlocked";
}

/** The theme choice of the pending reset. A missing or malformed marker keeps the theme. */
export function readPendingPreserveTheme(): boolean {
	const marker = readStoredMarker() ?? markerMirror;
	if (marker === null) return true;
	try {
		const parsed: unknown = JSON.parse(marker);
		const preserveTheme = (parsed as { preserveTheme?: unknown } | null)?.preserveTheme;
		return typeof preserveTheme === "boolean" ? preserveTheme : true;
	} catch {
		// A malformed marker still locks the app. Retry keeps the theme.
		return true;
	}
}
