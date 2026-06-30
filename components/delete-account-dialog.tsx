"use client";

import { useReducer } from "react";
import { AlertTriangleIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { deleteRemoteAccountAndTasks } from "@/lib/sync/pb-account-deletion";
import type { DeleteAccountResult } from "@/lib/sync/pb-account-deletion";
import { resetEverything, reloadAfterReset } from "@/lib/reset-everything";
import { disableSync } from "@/lib/sync/config";
import { UI_TIMING } from "@/lib/constants/ui";
import { toast } from "sonner";

interface DeleteAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Export the user's tasks to a JSON backup. Resolves `true` on success, `false` on failure. */
	onExport: () => Promise<boolean>;
	/** Called after a successful "keep local" deletion (so the host can refresh state). */
	onDeleted?: () => void;
}

interface DeleteAccountFormState {
	confirmText: string;
	exportFirst: boolean;
	hasExported: boolean;
	eraseLocal: boolean;
	isDeleting: boolean;
}

type DeleteAccountFormAction =
	| { type: "setConfirmText"; value: string }
	| { type: "setExportFirst"; value: boolean }
	| { type: "setHasExported"; value: boolean }
	| { type: "setEraseLocal"; value: boolean }
	| { type: "setDeleting"; value: boolean }
	| { type: "reset" };

const INITIAL_DELETE_FORM_STATE: DeleteAccountFormState = {
	confirmText: "",
	exportFirst: false,
	hasExported: false,
	eraseLocal: false,
	isDeleting: false,
};

function deleteAccountFormReducer(
	state: DeleteAccountFormState,
	action: DeleteAccountFormAction,
): DeleteAccountFormState {
	switch (action.type) {
		case "setConfirmText":
			return { ...state, confirmText: action.value };
		case "setExportFirst":
			// Turning the export toggle off invalidates any prior export.
			return { ...state, exportFirst: action.value, hasExported: action.value ? state.hasExported : false };
		case "setHasExported":
			return { ...state, hasExported: action.value };
		case "setEraseLocal":
			return { ...state, eraseLocal: action.value };
		case "setDeleting":
			return { ...state, isDeleting: action.value };
		case "reset":
			// Preserve the in-flight deleting flag; only clear the form inputs.
			return { ...INITIAL_DELETE_FORM_STATE, isDeleting: state.isDeleting };
	}
}

/** Human-readable message for a failed remote deletion, by failure mode. */
function failureMessage(result: DeleteAccountResult): string {
	if (result.authRejected) {
		return "Your session expired — sign in again to delete your account.";
	}
	if (result.stage === "tasks") {
		return "Couldn't reach the server to delete your account. Check your connection and try again.";
	}
	return "Couldn't delete your account right now. Check your connection and try again.";
}

/**
 * Confirmation dialog for permanently deleting the cloud account and all synced tasks.
 *
 * Mirrors the iOS/Mac flow: the remote delete runs first, and local data is only touched
 * after it succeeds. The user chooses whether to also erase the local copy on this device.
 */
export function DeleteAccountDialog({
	open,
	onOpenChange,
	onExport,
	onDeleted,
}: DeleteAccountDialogProps) {
	const [{ confirmText, exportFirst, hasExported, eraseLocal, isDeleting }, dispatch] = useReducer(
		deleteAccountFormReducer,
		INITIAL_DELETE_FORM_STATE,
	);

	const isConfirmed = confirmText === "DELETE";
	const canDelete = isConfirmed && (!exportFirst || hasExported);

	// onExport (the parent's handleExport) owns its own success/error toast and reports
	// whether the backup was actually written. Only a real success unlocks the delete gate.
	const handleExport = async () => {
		dispatch({ type: "setHasExported", value: await onExport() });
	};

	const handleDelete = async () => {
		if (!canDelete) return;
		dispatch({ type: "setDeleting", value: true });

		try {
			const result = await deleteRemoteAccountAndTasks();
			if (!result.ok) {
				toast.error(failureMessage(result));
				dispatch({ type: "setDeleting", value: false });
				return;
			}

			// Remote account is gone. Only now do we touch local data.
			if (eraseLocal) {
				await resetEverything({ preserveTheme: true });
				toast.success("Account deleted — reloading…");
				setTimeout(() => reloadAfterReset(), UI_TIMING.RESET_RELOAD_DELAY_MS);
				return;
			}

			await disableSync();
			toast.success("Account deleted. Your tasks remain on this device.");
			dispatch({ type: "setDeleting", value: false });
			dispatch({ type: "reset" });
			onOpenChange(false);
			onDeleted?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Account deletion failed");
			dispatch({ type: "setDeleting", value: false });
		}
	};

	const handleClose = () => {
		if (isDeleting) return;
		dispatch({ type: "reset" });
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-status-overdue">
						<AlertTriangleIcon className="h-5 w-5" />
						Delete Account
					</DialogTitle>
					<DialogDescription className="text-foreground-muted">
						This permanently deletes your account and every task synced to it. This
						cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* What will be deleted */}
					<div className="rounded-lg border border-status-overdue/35 bg-status-overdue-muted p-4">
						<h4 className="mb-2 font-semibold text-status-overdue">
							What will be deleted:
						</h4>
						<ul className="space-y-1 text-sm text-status-overdue">
							<li>• Your cloud account on the sync server</li>
							<li>• Every task synced to that account</li>
							{eraseLocal && <li>• All tasks and settings on this device</li>}
						</ul>
					</div>

					{/* Export option */}
					<div className="flex items-start gap-3 p-3 rounded-lg border border-border">
						<div className="flex-1 space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="export-first" className="text-sm font-medium cursor-pointer">
									Export my tasks first (recommended)
								</Label>
								<Switch
									id="export-first"
									checked={exportFirst}
									onCheckedChange={(checked) => dispatch({ type: "setExportFirst", value: checked === true })}
									disabled={isDeleting}
								/>
							</div>
							{exportFirst && !hasExported && (
								<Button
									variant="subtle"
									onClick={handleExport}
									disabled={isDeleting}
									className="w-full text-sm h-9"
								>
									<DownloadIcon className="mr-2 h-4 w-4" />
									Export Now
								</Button>
							)}
							{exportFirst && hasExported && (
								<p className="text-xs text-status-success">Exported successfully</p>
							)}
						</div>
					</div>

					{/* Erase local option (default off: keep tasks on this device) */}
					<div className="flex items-center justify-between p-3 rounded-lg border border-border">
						<Label htmlFor="erase-local" className="text-sm font-medium cursor-pointer">
							Also erase all tasks from this browser
						</Label>
						<Switch
							id="erase-local"
							checked={eraseLocal}
							onCheckedChange={(checked) => dispatch({ type: "setEraseLocal", value: checked === true })}
							disabled={isDeleting}
						/>
					</div>

					{/* Confirmation input */}
					<div className="space-y-2">
						<Label htmlFor="confirm-delete" className="text-sm font-semibold">
							Type <span className="font-mono text-status-overdue">DELETE</span> to confirm:
						</Label>
						<Input
							id="confirm-delete"
							value={confirmText}
							onChange={(e) => dispatch({ type: "setConfirmText", value: e.target.value })}
							placeholder="Type DELETE here"
							disabled={isDeleting}
							className="font-mono"
						/>
					</div>

					{/* Actions */}
					<div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
						<Button variant="subtle" onClick={handleClose} disabled={isDeleting}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={!canDelete || isDeleting}
						>
							{isDeleting ? "Deleting…" : "Delete account"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
