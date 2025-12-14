"use client";

import { useState } from "react";
import { MailIcon, CopyIcon, Share2Icon } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { TaskRecord } from "@/lib/types";
import { formatDueDate } from "@/lib/utils";
import { TOAST_DURATION } from "@/lib/constants";

interface ShareTaskDialogProps {
	task: TaskRecord | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type ShareTab = "native" | "email" | "copy";

/**
 * Check if the Web Share API is available
 * Supported on mobile browsers (iOS Safari 12.2+, Chrome Android 61+)
 */
function canUseWebShare(): boolean {
	return typeof navigator !== "undefined" && navigator.share !== undefined;
}

// ============================================================================
// Task Formatting Helpers
// Each helper handles one section, keeping functions under 30 lines
// ============================================================================

/** Format task header with title */
function formatTaskHeader(task: TaskRecord): string[] {
	return [`Task: ${task.title}`, ""];
}

/** Format optional task description */
function formatTaskDescription(task: TaskRecord): string[] {
	if (!task.description) return [];
	return ["Description:", task.description, ""];
}

/** Format task metadata: status, priority, due date, tags */
function formatTaskMetadata(task: TaskRecord): string[] {
	const lines: string[] = ["Details:"];
	lines.push(`Status: ${task.completed ? "Completed" : "To Do"}`);

	const priority = task.urgent && task.important
		? "Urgent & Important"
		: task.urgent ? "Urgent" : task.important ? "Important" : "Low Priority";
	lines.push(`Priority: ${priority}`);

	if (task.dueDate) {
		lines.push(`Due: ${formatDueDate(task.dueDate)}`);
	}
	if (task.tags.length > 0) {
		lines.push(`Tags: ${task.tags.join(", ")}`);
	}
	return lines;
}

/** Format subtasks list with checkboxes */
function formatTaskSubtasks(task: TaskRecord): string[] {
	if (task.subtasks.length === 0) return [];
	const lines = ["", "Subtasks:"];
	task.subtasks.forEach((subtask) => {
		lines.push(`  ${subtask.completed ? "☑" : "☐"} ${subtask.title}`);
	});
	return lines;
}

/** Format footer with creation date and attribution */
function formatTaskFooter(task: TaskRecord): string[] {
	return [
		"",
		`Created: ${new Date(task.createdAt).toLocaleDateString()}`,
		"",
		"Sent from GSD Task Manager (https://gsd.vinny.dev)",
	];
}

/** Compose all sections into complete task details */
function formatTaskDetails(task: TaskRecord): string {
	return [
		...formatTaskHeader(task),
		...formatTaskDescription(task),
		...formatTaskMetadata(task),
		...formatTaskSubtasks(task),
		...formatTaskFooter(task),
	].join("\n");
}

export function ShareTaskDialog({
	task,
	open,
	onOpenChange,
}: ShareTaskDialogProps) {
	const [activeTab, setActiveTab] = useState<ShareTab>(
		canUseWebShare() ? "native" : "email",
	);
	const [recipientEmail, setRecipientEmail] = useState("");
	const { showToast } = useToast();

	if (!task) {
		return null;
	}

	const taskDetails = formatTaskDetails(task);
	const emailSubject = `Task: ${task.title}`;
	const emailBody = encodeURIComponent(taskDetails);

	const handleOpenEmailClient = () => {
		const mailto = recipientEmail
			? `mailto:${recipientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`
			: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`;

		// Create a temporary anchor element to trigger mailto without navigating away
		const anchor = document.createElement("a");
		anchor.href = mailto;
		anchor.target = "_blank";
		anchor.rel = "noopener noreferrer";

		// Trigger click and clean up
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);

		onOpenChange(false);
	};

	const handleCopyDetails = async () => {
		try {
			await navigator.clipboard.writeText(taskDetails);
			showToast("Task details copied to clipboard", undefined, TOAST_DURATION.SHORT);
			onOpenChange(false);
		} catch {
			showToast("Failed to copy to clipboard", undefined, TOAST_DURATION.SHORT);
		}
	};

	const handleNativeShare = async () => {
		try {
			await navigator.share({
				title: `Task: ${task.title}`,
				text: taskDetails,
			});
			showToast("Task shared successfully", undefined, TOAST_DURATION.SHORT);
			onOpenChange(false);
		} catch (error) {
			// AbortError means user cancelled the share - don't show error
			if ((error as Error).name !== "AbortError") {
				console.error("Failed to share task:", error);
				showToast("Failed to share task", undefined, TOAST_DURATION.SHORT);
			}
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Share2Icon className="h-5 w-5" />
						Share Task: {task.title}
					</DialogTitle>
					<DialogDescription>
						{canUseWebShare()
							? "Share this task to any app, via email, or copy to clipboard"
							: "Share this task via email or copy the details to your clipboard"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Tab buttons */}
					<div className="flex gap-2 border-b border-border">
						{canUseWebShare() && (
							<button
								onClick={() => setActiveTab("native")}
								className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
									activeTab === "native"
										? "border-accent text-accent"
										: "border-transparent text-foreground-muted hover:text-foreground"
								}`}
							>
								<Share2Icon className="h-4 w-4" />
								Share
							</button>
						)}
						<button
							onClick={() => setActiveTab("email")}
							className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
								activeTab === "email"
									? "border-accent text-accent"
									: "border-transparent text-foreground-muted hover:text-foreground"
							}`}
						>
							<MailIcon className="h-4 w-4" />
							Email
						</button>
						<button
							onClick={() => setActiveTab("copy")}
							className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
								activeTab === "copy"
									? "border-accent text-accent"
									: "border-transparent text-foreground-muted hover:text-foreground"
							}`}
						>
							<CopyIcon className="h-4 w-4" />
							Copy Details
						</button>
					</div>

					{/* Native Share tab content */}
					{activeTab === "native" && (
						<div className="space-y-3">
							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">
									Task Details
								</p>
								<div className="rounded-md border border-border bg-background-muted p-3 max-h-64 overflow-y-auto">
									<pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
										{taskDetails}
									</pre>
								</div>
							</div>
							<p className="text-xs text-foreground-muted">
								Share this task to WhatsApp, Messages, Slack, email, or any
								installed app on your device
							</p>
						</div>
					)}

					{/* Email tab content */}
					{activeTab === "email" && (
						<div className="space-y-3">
							<div className="space-y-1">
								<label
									htmlFor="recipient-email"
									className="text-sm font-medium text-foreground"
								>
									Recipient Email (optional)
								</label>
								<Input
									id="recipient-email"
									type="email"
									placeholder="Enter email address..."
									value={recipientEmail}
									onChange={(e) => setRecipientEmail(e.target.value)}
								/>
							</div>

							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">
									Email Preview
								</p>
								<div className="rounded-md border border-border bg-background-muted p-3 max-h-64 overflow-y-auto">
									<pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
										{taskDetails}
									</pre>
								</div>
							</div>
						</div>
					)}

					{/* Copy tab content */}
					{activeTab === "copy" && (
						<div className="space-y-3">
							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">
									Task Details
								</p>
								<div className="rounded-md border border-border bg-background-muted p-3 max-h-64 overflow-y-auto">
									<pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
										{taskDetails}
									</pre>
								</div>
							</div>
							<p className="text-xs text-foreground-muted">
								Click &quot;Copy Details&quot; to copy this text to your
								clipboard
							</p>
						</div>
					)}

					{/* Action buttons */}
					<div className="flex items-center justify-end gap-2 pt-2">
						<Button variant="subtle" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						{activeTab === "native" ? (
							<Button onClick={handleNativeShare} className="gap-2">
								<Share2Icon className="h-4 w-4" />
								Share
							</Button>
						) : activeTab === "email" ? (
							<Button onClick={handleOpenEmailClient} className="gap-2">
								<MailIcon className="h-4 w-4" />
								Open Email Client
							</Button>
						) : (
							<Button onClick={handleCopyDetails} className="gap-2">
								<CopyIcon className="h-4 w-4" />
								Copy Details
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
