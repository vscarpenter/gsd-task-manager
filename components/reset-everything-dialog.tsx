"use client";

import { useState } from "react";
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
import type { ResetOptions } from "@/lib/reset-everything";
import { toast } from "sonner";

interface ResetEverythingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onExport: () => Promise<void>;
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
	const [confirmText, setConfirmText] = useState("");
	const [exportFirst, setExportFirst] = useState(false);
	const [preserveTheme, setPreserveTheme] = useState(true);
	const [hasExported, setHasExported] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	const totalTasks = activeTasks + completedTasks;
	const isConfirmed = confirmText === "RESET";
	const canReset = isConfirmed && (!exportFirst || hasExported);

	const handleExport = async () => {
		try {
			await onExport();
			setHasExported(true);
			toast.success("Tasks exported successfully");
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Export failed";
			toast.error(errorMsg);
		}
	};

	const handleReset = async () => {
		if (!canReset) return;

		setIsResetting(true);

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
				}, 1000);
			} else {
				// Partial failure
				toast.error(`Reset completed with errors: ${result.errors.join(", ")}`);
				setIsResetting(false);
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Reset failed";
			toast.error(errorMsg);
			setIsResetting(false);
		}
	};

	const handleClose = () => {
		if (!isResetting) {
			setConfirmText("");
			setExportFirst(false);
			setHasExported(false);
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-red-600">
						<AlertTriangleIcon className="h-5 w-5" />
						Reset Everything
					</DialogTitle>
					<DialogDescription className="text-foreground-muted">
						This will permanently delete all your data. This action cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Data Summary */}
					<div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 p-4">
						<h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
							What will be deleted:
						</h4>
						<ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
							<li>• {totalTasks} task{totalTasks !== 1 ? "s" : ""} ({activeTasks} active, {completedTasks} completed)</li>
							<li>• All custom smart views</li>
							<li>• All notification settings</li>
							<li>• All archive settings</li>
							{syncEnabled && (
								<li>• Cloud sync configuration (you will be logged out)</li>
							)}
							{pendingSync > 0 && (
								<li className="font-semibold text-red-600 dark:text-red-400">
									⚠️ {pendingSync} unsynchronized change{pendingSync !== 1 ? "s" : ""}
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
									onCheckedChange={(checked) => {
										setExportFirst(checked === true);
										if (!checked) setHasExported(false);
									}}
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
								<p className="text-xs text-green-600">✓ Exported successfully</p>
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
							onCheckedChange={(checked) => setPreserveTheme(checked === true)}
							disabled={isResetting}
						/>
					</div>

					{/* Confirmation Input */}
					<div className="space-y-2">
						<Label htmlFor="confirm-text" className="text-sm font-semibold">
							Type <span className="font-mono text-red-600">RESET</span> to confirm:
						</Label>
						<Input
							id="confirm-text"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
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
							variant="primary"
							onClick={handleReset}
							disabled={!canReset || isResetting}
							className="bg-red-600 hover:bg-red-700 disabled:bg-red-400"
						>
							{isResetting ? "Resetting..." : "Reset Everything"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
