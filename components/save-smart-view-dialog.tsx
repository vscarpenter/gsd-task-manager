"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSmartView } from "@/lib/smart-views";
import type { FilterCriteria } from "@/lib/filters";

interface SaveSmartViewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	criteria: FilterCriteria;
	onSaved?: () => void;
}

export function SaveSmartViewDialog({
	open,
	onOpenChange,
	criteria,
	onSaved,
}: SaveSmartViewDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [icon, setIcon] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState("");

	const handleSave = async () => {
		if (!name.trim()) {
			setError("Please enter a name for this view");
			return;
		}

		setIsSaving(true);
		setError("");

		try {
			await createSmartView({
				name: name.trim(),
				description: description.trim() || undefined,
				icon: icon.trim() || undefined,
				criteria,
			});

			// Reset form
			setName("");
			setDescription("");
			setIcon("");
			onOpenChange(false);

			if (onSaved) {
				onSaved();
			}
		} catch (err) {
			console.error("Failed to save Smart View:", err);
			setError("Failed to save Smart View. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save as Smart View</DialogTitle>
					<DialogDescription>
						Create a custom Smart View from your current filter settings
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<Label htmlFor="view-name">Name *</Label>
						<Input
							id="view-name"
							placeholder="e.g., My Weekly Tasks"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={50}
							required
						/>
					</div>

					<div>
						<Label htmlFor="view-description">Description</Label>
						<Textarea
							id="view-description"
							placeholder="What this view shows..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={150}
							rows={2}
						/>
					</div>

					<div>
						<Label htmlFor="view-icon">Icon (emoji)</Label>
						<Input
							id="view-icon"
							placeholder="e.g., 🎯"
							value={icon}
							onChange={(e) => setIcon(e.target.value)}
							maxLength={2}
						/>
						<p className="mt-1 text-xs text-foreground-muted">
							Optional emoji to display next to the view name
						</p>
					</div>

					{error && (
						<div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
							{error}
						</div>
					)}

					<div className="flex justify-end gap-2 pt-2">
						<Button
							variant="subtle"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving..." : "Save View"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
