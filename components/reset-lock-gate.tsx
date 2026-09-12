"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { UI_TIMING } from "@/lib/constants/ui";
import { reloadAfterReset, resetEverything } from "@/lib/reset-everything";
import {
	RESET_PENDING_KEY,
	getResetLockServerSnapshot,
	getResetLockSnapshot,
	readPendingPreserveTheme,
	subscribeToResetLock,
	type ResetLockState,
} from "@/lib/reset-lock";

type ShownLock = Exclude<ResetLockState, "unlocked">;

/**
 * Keeps every task surface unmounted while Reset Everything runs, and after a
 * run that could not prove local data is gone. A shared browser then never
 * shows the previous user's tasks, and deleting them is the only way forward.
 */
export function ResetLockGate({ children }: { children: ReactNode }) {
	const lockState = useSyncExternalStore(
		subscribeToResetLock,
		getResetLockSnapshot,
		getResetLockServerSnapshot,
	);
	// The last lock this gate showed, stored during render. After any lock the app
	// never remounts before the reload, because FirstTimeRedirect and the
	// onboarding tour would act on flags the reset just cleared.
	const [shownLock, setShownLock] = useState<ShownLock | null>(null);
	if (lockState !== "unlocked" && lockState !== shownLock) {
		setShownLock(lockState);
	}
	useReloadWhenOwnLockOutlivesMarker(lockState === "locked");
	useReloadAfterUnlock(lockState === "unlocked" ? shownLock : null);

	if (lockState === "unlocked" && shownLock === null) return <>{children}</>;
	return <ResetLockScreen running={lockState !== "locked"} />;
}

/**
 * A tab whose own reset failed stays locked through its in-memory mirror even
 * after another tab deletes the data and removes the marker, so its snapshot
 * never changes. Only the storage event can tell that tab to reload.
 */
function useReloadWhenOwnLockOutlivesMarker(locked: boolean): void {
	useEffect(() => {
		if (!locked) return;
		const handleStorage = (event: StorageEvent) => {
			const removed = event.key === RESET_PENDING_KEY && event.newValue === null;
			// A tab without its own lock unlocks through the store, and useReloadAfterUnlock reloads it.
			if (removed && getResetLockSnapshot() === "locked") reloadAfterReset();
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [locked]);
}

/**
 * Reload once a shown lock turns unlocked, without remounting the app. A lock
 * another tab lifted reloads now, because this document's stores and database
 * connection predate the wipe. In a browser this cannot rely on the storage
 * listener: React re-renders after the store's listener and removes the gate's
 * listener before the browser calls it. A reset that finished here waits for
 * the reset delay so its toast stays readable, which also covers dialog runs
 * whose sign-out or browser-storage step failed and that never reload.
 */
function useReloadAfterUnlock(unlockedFrom: ShownLock | null): void {
	useEffect(() => {
		if (unlockedFrom === null) return;
		if (unlockedFrom === "locked") {
			reloadAfterReset();
			return;
		}
		const timer = setTimeout(reloadAfterReset, UI_TIMING.RESET_RELOAD_DELAY_MS);
		return () => clearTimeout(timer);
	}, [unlockedFrom]);
}

/** Rerun the reset. Resolves to an error to announce, or null once the reload starts. */
async function retryReset(): Promise<string | null> {
	try {
		const result = await resetEverything({ preserveTheme: readPendingPreserveTheme() });
		if (result.failedSteps.includes("local-data")) {
			return `Couldn't delete your data. ${result.errors.join(", ")}`;
		}
		reloadAfterReset();
		return null;
	} catch (err) {
		return `Couldn't delete your data. ${err instanceof Error ? err.message : "Unknown error"}`;
	}
}

function ResetLockScreen({ running }: { running: boolean }) {
	const [retryError, setRetryError] = useState<string | null>(null);
	const screenRef = useRef<HTMLElement>(null);
	const statusId = useId();
	const headingId = useId();

	// Focus the screen on mount and on every switch between progress and locked. Its
	// name then tells a screen reader what changed, and focus never stays on the page
	// body after a dialog closes.
	useEffect(() => {
		screenRef.current?.focus({ preventScroll: true });
	}, [running]);

	const retry = async () => {
		setRetryError(null);
		setRetryError(await retryReset());
	};

	return (
		<main
			ref={screenRef}
			tabIndex={-1}
			aria-labelledby={running ? statusId : headingId}
			className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 outline-none"
		>
			{running ? (
				<ResetProgress statusId={statusId} />
			) : (
				<LockedMessage headingId={headingId} retryError={retryError} onRetry={retry} />
			)}
		</main>
	);
}

function ResetProgress({ statusId }: { statusId: string }) {
	return (
		<p id={statusId} role="status" className="text-h2 font-semibold tracking-tight text-foreground">
			Deleting your data…
		</p>
	);
}

interface LockedMessageProps {
	headingId: string;
	retryError: string | null;
	onRetry: () => void;
}

function LockedMessage({ headingId, retryError, onRetry }: LockedMessageProps) {
	return (
		<>
			<div className="max-w-md space-y-3 text-center">
				<h1 id={headingId} className="text-h1 font-semibold tracking-tight text-foreground">
					{"Reset didn't finish"}
				</h1>
				<p className="text-base leading-relaxed text-foreground-muted">
					{"Your tasks are still saved in this browser. GSD stays locked until they're deleted."}
				</p>
			</div>
			<Button onClick={onRetry}>Try again</Button>
			<div className="max-w-md space-y-2 text-center text-sm">
				<p role="alert" className="text-status-overdue-ink">
					{retryError}
				</p>
				<p className="text-foreground-muted">
					{"If this keeps failing, clear this site's data in your browser settings."}
				</p>
			</div>
		</>
	);
}
