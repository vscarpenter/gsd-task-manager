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
import { resetEverything, reloadAfterReset } from "@/lib/reset-everything";
import { UI_TIMING } from "@/lib/constants/ui";
import type { ResetOptions } from "@/lib/reset-everything";
import { toast } from "sonner";

interface ResetFormState {
	confirmText: string;
	exportFirst: boolean;
	preserveTheme: boolean;
	hasExported: boolean;
	isResetting: boolean;
}

type ResetFormAction =
	| { type: "setConfirmText"; value: string }
	| { type: "setExportFirst"; value: boolean }
	| { type: "setPreserveTheme"; value: boolean }
	| { type: "setHasExported"; value: boolean }
	| { type: "setResetting"; value: boolean }
	| { type: "resetInputs" };

const INITIAL_RESET_FORM_STATE: ResetFormState = {
	confirmText: "",
	exportFirst: false,
	preserveTheme: true,
	hasExported: false,
	isResetting: false,
};

function resetFormReducer(state: ResetFormState, action: ResetFormAction): ResetFormState {
	switch (action.type) {
		case "setConfirmText":
			return { ...state, confirmText: action.value };
		case "setExportFirst":
			// Turning the export toggle off invalidates any prior export.
			return { ...state, exportFirst: action.value, hasExported: action.value ? state.hasExported : false };
		case "setPreserveTheme":
			return { ...state, preserveTheme: action.value };
		case "setHasExported":
			return { ...state, hasExported: action.value };
		case "setResetting":
			return { ...state, isResetting: action.value };
		case "resetInputs":
			// Clear the confirmation inputs but keep the sticky theme toggle.
			return { ...state, confirmText: "", exportFirst: false, hasExported: false };
	}
}

interface ResetEverythingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Export tasks to a JSON backup. Resolves `true` on success, `false` on failure. */
	onExport: () => Promise<boolean>;
	activeTasks: number;
	completedTasks: number;
	syncEnabled: boolean;
	pendingSync: number;
}

/**
 * Confirmation dialog for resetting all application data
 *
 * Safety features:
 * - Shows data counts before reset
 * - Warns about pending sync operations
 * - Allows export before reset
 * - Requires typing "RESET" to confirm
 * - Optional theme preservation
 */
export function ResetEverythingDialog({
	open,
	onOpenChange,
	onExport,
	activeTasks,
	completedTasks,
	syncEnabled,
	pendingSync,
}: ResetEverythingDialogProps) {
	const [{ confirmText, exportFirst, preserveTheme, hasExported, isResetting }, dispatch] = useReducer(
		resetFormReducer,
		INITIAL_RESET_FORM_STATE,
	);

	const totalTasks = activeTasks + completedTasks;
	const isConfirmed = confirmText === "RESET";
	const canReset = isConfirmed && (!exportFirst || hasExported);

	// onExport (the parent's handleExport) owns its own success/error toast and reports
	// whether the backup was actually written. Only a real success unlocks the reset gate.
	const handleExport = async () => {
		dispatch({ type: "setHasExported", value: await onExport() });
	};

	const handleReset = async () => {
		if (!canReset) return;

		dispatch({ type: "setResetting", value: true });

		try {
			const options: ResetOptions = {
				preserveTheme,
			};

			const result = await resetEverything(options);

			if (result.success) {
				toast.success("Reset complete - reloading application...");

				// Wait for toast to show before reload
				setTimeout(() => {
					reloadAfterReset();
				}, UI_TIMING.RESET_RELOAD_DELAY_MS);
			} else {
				// Partial failure
				toast.error(`Reset completed with errors: ${result.errors.join(", ")}`);
				dispatch({ type: "setResetting", value: false });
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Reset failed";
			toast.error(errorMsg);
			dispatch({ type: "setResetting", value: false });
		}
	};

	const handleClose = () => {
		if (!isResetting) {
			dispatch({ type: "resetInputs" });
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-status-overdue">
						<AlertTriangleIcon className="h-5 w-5" />
						Reset Everything
					</DialogTitle>
					<DialogDescription className="text-foreground-muted">
						This will permanently delete all your data. This action cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Data Summary */}
					<div className="rounded-lg border border-status-overdue/35 bg-status-overdue-muted p-4">
						<h4 className="mb-2 font-semibold text-status-overdue">
							What will be deleted:
						</h4>
						<ul className="space-y-1 text-sm text-status-overdue">
							<li>• {totalTasks} task{totalTasks !== 1 ? "s" : ""} ({activeTasks} active, {completedTasks} completed)</li>
							<li>• All custom smart views</li>
							<li>• All notification settings</li>
							<li>• All archive settings</li>
							{syncEnabled && (
								<li>• Cloud sync configuration (you will be logged out)</li>
							)}
							{pendingSync > 0 && (
								<li className="font-semibold text-status-overdue">
									{pendingSync} unsynchronized change{pendingSync !== 1 ? "s" : ""}
								</li>
							)}
						</ul>
					</div>

					{/* What will be preserved */}
					<div className="rounded-lg border border-border bg-background-muted/50 p-4">
						<h4 className="font-semibold text-foreground mb-2">
							What will be preserved:
						</h4>
						<ul className="space-y-1 text-sm text-foreground-muted">
							<li>• Built-in smart views</li>
							<li>• Device ID (for future sync registration)</li>
							{preserveTheme && <li>• Your theme preference</li>}
						</ul>
					</div>

					{/* Export Option */}
					<div className="flex items-start gap-3 p-3 rounded-lg border border-border">
						<div className="flex-1 space-y-2">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="export-first"
									className="text-sm font-medium cursor-pointer"
								>
									Export my data first (recommended)
								</Label>
								<Switch
									id="export-first"
									checked={exportFirst}
									onCheckedChange={(checked) => dispatch({ type: "setExportFirst", value: checked === true })}
									disabled={isResetting}
								/>
							</div>
							{exportFirst && !hasExported && (
								<Button
									variant="subtle"
									onClick={handleExport}
									disabled={isResetting}
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

					{/* Theme Preservation */}
					<div className="flex items-center justify-between p-3 rounded-lg border border-border">
						<Label
							htmlFor="preserve-theme"
							className="text-sm font-medium cursor-pointer"
						>
							Preserve my theme preference
						</Label>
						<Switch
							id="preserve-theme"
							checked={preserveTheme}
							onCheckedChange={(checked) => dispatch({ type: "setPreserveTheme", value: checked === true })}
							disabled={isResetting}
						/>
					</div>

					{/* Confirmation Input */}
					<div className="space-y-2">
						<Label htmlFor="confirm-text" className="text-sm font-semibold">
							Type <span className="font-mono text-status-overdue">RESET</span> to confirm:
						</Label>
						<Input
							id="confirm-text"
							value={confirmText}
							onChange={(e) => dispatch({ type: "setConfirmText", value: e.target.value })}
							placeholder="Type RESET here"
							disabled={isResetting}
							className="font-mono"
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
						<Button
							variant="subtle"
							onClick={handleClose}
							disabled={isResetting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleReset}
							disabled={!canReset || isResetting}
						>
							{isResetting ? "Resetting..." : "Reset Everything"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
