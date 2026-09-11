"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSyncStatus, disableSync } from "@/lib/sync/config";
import { createLogger } from "@/lib/logger";
import { SettingsRow } from "./shared-components";
import { LogoutConfirmation } from "@/components/sync/sync-auth-dialog-sections";

const logger = createLogger("UI");

type SyncStatusSnapshot = Awaited<ReturnType<typeof getSyncStatus>>;

/** Disconnect the account and tell the user. Resolves `true` when it worked. */
async function signOutAndReport(): Promise<boolean> {
	try {
		await disableSync();
		toast.success("Signed out");
		return true;
	} catch (error) {
		logger.error("Sign out failed", error instanceof Error ? error : undefined);
		toast.error("Sign out failed");
		return false;
	}
}

async function readStatus(): Promise<SyncStatusSnapshot | null> {
	try {
		return await getSyncStatus();
	} catch (error) {
		logger.error(
			"Failed to load sync status",
			error instanceof Error ? error : undefined,
		);
		return null;
	}
}

/** A disconnected account leaves no trace of itself in the snapshot. */
function asSignedOut(prev: SyncStatusSnapshot): SyncStatusSnapshot {
	return { ...prev, enabled: false, email: null, pendingCount: 0 };
}

interface AccountViewProps {
	status: SyncStatusSnapshot;
	isSigningOut: boolean;
	showConfirm: boolean;
	onSignOut: () => void;
	onConfirm: () => void;
	onCancel: () => void;
}

function AccountView({
	status,
	isSigningOut,
	showConfirm,
	onSignOut,
	onConfirm,
	onCancel,
}: AccountViewProps) {
	return (
		<>
			<SettingsRow label="Account" description={status.email ?? undefined}>
				<Button variant="subtle" onClick={onSignOut} disabled={isSigningOut}>
					{isSigningOut ? "Signing out…" : "Sign out"}
				</Button>
			</SettingsRow>

			{showConfirm && (
				<div className="px-4 pb-3.5">
					<LogoutConfirmation
						pendingChanges={status.pendingCount}
						isLoading={isSigningOut}
						onCancel={onCancel}
						onConfirm={onConfirm}
					/>
				</div>
			)}
		</>
	);
}

/**
 * The connected account and its sign-out control. Renders nothing when no
 * account is connected, so the section stays quiet for local-only use.
 */
export function SyncAccountRow() {
	const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
	const [showConfirm, setShowConfirm] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);

	useEffect(() => {
		void readStatus().then(setStatus);
	}, []);

	async function handleSignOut() {
		// Re-read rather than trust the mounted snapshot: the queue may have
		// filled since this page loaded, and disableSync discards it.
		const fresh = await readStatus();
		if (fresh) setStatus(fresh);
		if (fresh && fresh.pendingCount > 0) {
			setShowConfirm(true);
			return;
		}
		await confirmSignOut();
	}

	async function confirmSignOut() {
		setIsSigningOut(true);
		if (await signOutAndReport()) {
			setStatus((prev) => (prev ? asSignedOut(prev) : prev));
			setShowConfirm(false);
		}
		setIsSigningOut(false);
	}

	if (!status?.enabled) return null;

	return (
		<AccountView
			status={status}
			isSigningOut={isSigningOut}
			showConfirm={showConfirm}
			onSignOut={handleSignOut}
			onConfirm={confirmSignOut}
			onCancel={() => setShowConfirm(false)}
		/>
	);
}
