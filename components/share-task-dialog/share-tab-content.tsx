"use client";

import { MailIcon, CopyIcon, Share2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { canUseWebShare } from "@/components/share-task-dialog/format-task-details";

type ShareTab = "native" | "email" | "copy";

interface TaskDetailsPreviewProps {
	label: string;
	taskDetails: string;
}

/** Reusable preview block showing formatted task details */
function TaskDetailsPreview({ label, taskDetails }: TaskDetailsPreviewProps) {
	return (
		<div className="space-y-1">
			<p className="text-sm font-medium text-foreground">{label}</p>
			<div className="rounded-md border border-border bg-background-muted p-3 max-h-64 overflow-y-auto">
				<pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
					{taskDetails}
				</pre>
			</div>
		</div>
	);
}

interface ShareTabButtonsProps {
	activeTab: ShareTab;
	onTabChange: (tab: ShareTab) => void;
}

/** Tab navigation buttons for share dialog */
export function ShareTabButtons({ activeTab, onTabChange }: ShareTabButtonsProps) {
	const tabClass = (tab: ShareTab) =>
		`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
			activeTab === tab
				? "border-accent text-accent"
				: "border-transparent text-foreground-muted hover:text-foreground"
		}`;

	return (
		<div className="flex gap-2 border-b border-border">
			{canUseWebShare() && (
				<button onClick={() => onTabChange("native")} className={tabClass("native")}>
					<Share2Icon className="h-4 w-4" />
					Share
				</button>
			)}
			<button onClick={() => onTabChange("email")} className={tabClass("email")}>
				<MailIcon className="h-4 w-4" />
				Email
			</button>
			<button onClick={() => onTabChange("copy")} className={tabClass("copy")}>
				<CopyIcon className="h-4 w-4" />
				Copy Details
			</button>
		</div>
	);
}

interface ShareTabContentProps {
	activeTab: ShareTab;
	taskDetails: string;
	recipientEmail: string;
	onRecipientEmailChange: (email: string) => void;
}

/** Renders the correct tab panel based on activeTab */
export function ShareTabContent({
	activeTab,
	taskDetails,
	recipientEmail,
	onRecipientEmailChange,
}: ShareTabContentProps) {
	if (activeTab === "native") {
		return (
			<div className="space-y-3">
				<TaskDetailsPreview label="Task Details" taskDetails={taskDetails} />
				<p className="text-xs text-foreground-muted">
					Share this task to WhatsApp, Messages, Slack, email, or any
					installed app on your device
				</p>
			</div>
		);
	}

	if (activeTab === "email") {
		return (
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
						onChange={(e) => onRecipientEmailChange(e.target.value)}
					/>
				</div>
				<TaskDetailsPreview label="Email Preview" taskDetails={taskDetails} />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<TaskDetailsPreview label="Task Details" taskDetails={taskDetails} />
			<p className="text-xs text-foreground-muted">
				Click &quot;Copy Details&quot; to copy this text to your
				clipboard
			</p>
		</div>
	);
}

export type { ShareTab };
