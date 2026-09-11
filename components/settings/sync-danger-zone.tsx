"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";

interface SyncDangerZoneProps {
	/** Export tasks to a JSON backup (offered before account deletion). Resolves `true` on success. */
	onExport: () => Promise<boolean>;
	/** Called after a successful account deletion so the page can refresh sync state. */
	onAccountDeleted: () => void;
}

/** Permanent account deletion, fenced off from the reversible controls above. */
export function SyncDangerZone({ onExport, onAccountDeleted }: SyncDangerZoneProps) {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	return (
		<>
			<div className="px-4 py-3.5">
				<div className="rounded-lg border border-status-overdue/35 bg-status-overdue-muted/40 p-4 space-y-3">
					<div>
						<p className="text-sm font-semibold text-status-overdue-ink">Danger zone</p>
						<p className="text-xs text-foreground-muted mt-1">
							Permanently delete your account and every task synced to it. This
							cannot be undone.
						</p>
					</div>
					<Button
						variant="destructive"
						onClick={() => setDeleteDialogOpen(true)}
						className="w-full sm:w-auto"
					>
						<Trash2Icon className="mr-2 h-4 w-4" />
						Delete account…
					</Button>
				</div>
			</div>

			<DeleteAccountDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onExport={onExport}
				onDeleted={onAccountDeleted}
			/>
		</>
	);
}
