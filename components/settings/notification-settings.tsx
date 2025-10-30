"use client";

import { BellIcon, ChevronRightIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { NotificationSettings } from "@/lib/types";

interface NotificationSettingsProps {
	isExpanded: boolean;
	onToggle: () => void;
	settings: NotificationSettings | null;
	onNotificationToggle: () => Promise<void>;
	onDefaultReminderChange: (value: string) => Promise<void>;
}

export function NotificationSettingsSection({
	isExpanded,
	onToggle,
	settings,
	onNotificationToggle,
	onDefaultReminderChange,
}: NotificationSettingsProps) {
	return (
		<Collapsible open={isExpanded} onOpenChange={onToggle}>
			<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
				<div className="flex items-center gap-3">
					<BellIcon className="h-5 w-5 text-accent" />
					<span className="font-semibold text-foreground">Notifications</span>
				</div>
				<ChevronRightIcon
					className={`h-5 w-5 text-foreground-muted transition-transform ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
				{settings && (
					<>
						{/* Enable Notifications */}
						<div className="flex items-center justify-between">
							<div>
								<Label htmlFor="enable-notifications">
									Enable browser notifications
								</Label>
								<p className="text-xs text-foreground-muted">
									Show browser notifications for task reminders
								</p>
							</div>
							<Switch
								id="enable-notifications"
								checked={settings.enabled}
								onCheckedChange={onNotificationToggle}
							/>
						</div>

						{/* Default Reminder Time */}
						{settings.enabled && (
							<div className="space-y-2">
								<Label htmlFor="default-reminder">Default reminder time</Label>
								<Select
									value={settings.defaultReminder.toString()}
									onValueChange={onDefaultReminderChange}
								>
									<SelectTrigger id="default-reminder">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="15">15 minutes before</SelectItem>
										<SelectItem value="30">30 minutes before</SelectItem>
										<SelectItem value="60">1 hour before</SelectItem>
										<SelectItem value="120">2 hours before</SelectItem>
										<SelectItem value="1440">1 day before</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-foreground-muted">
									Default reminder time for new tasks with due dates
								</p>
							</div>
						)}

						{/* Permission Status */}
						{"Notification" in window && (
							<div className="rounded-lg border border-border bg-background-muted/50 p-3">
								<p className="text-xs text-foreground-muted">
									Browser permission:{" "}
									<span className="font-medium text-foreground">
										{Notification.permission === "granted"
											? "Granted ✓"
											: Notification.permission === "denied"
												? "Denied"
												: "Not requested"}
									</span>
								</p>
							</div>
						)}
					</>
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}
