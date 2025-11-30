"use client";

import { Switch } from "@/components/ui/switch";
import type { NotificationSettings } from "@/lib/types";
import { SettingsRow, SettingsSelectRow } from "./shared-components";

interface NotificationSettingsProps {
	settings: NotificationSettings | null;
	onNotificationToggle: () => Promise<void>;
	onDefaultReminderChange: (value: string) => Promise<void>;
}

const REMINDER_OPTIONS = [
	{ value: "15", label: "15 minutes" },
	{ value: "30", label: "30 minutes" },
	{ value: "60", label: "1 hour" },
	{ value: "120", label: "2 hours" },
	{ value: "1440", label: "1 day" },
];

/**
 * iOS-style notification settings with inline controls
 */
export function NotificationSettingsSection({
	settings,
	onNotificationToggle,
	onDefaultReminderChange,
}: NotificationSettingsProps) {
	if (!settings) {
		return (
			<div className="px-4 py-3.5">
				<p className="text-sm text-foreground-muted">Loading...</p>
			</div>
		);
	}

	const currentReminder = REMINDER_OPTIONS.find(
		(opt) => opt.value === settings.defaultReminder.toString()
	);

	return (
		<>
			{/* Enable Notifications Row */}
			<SettingsRow label="Push notifications" description="Get reminded about tasks">
				<Switch
					checked={settings.enabled}
					onCheckedChange={onNotificationToggle}
				/>
			</SettingsRow>

			{/* Reminder Time Row - Only show when enabled */}
			{settings.enabled && (
				<SettingsSelectRow
					label="Default reminder"
					value={currentReminder?.label || "30 minutes"}
					options={REMINDER_OPTIONS}
					onChange={onDefaultReminderChange}
				/>
			)}

			{/* Permission Status Row */}
			{"Notification" in window && (
				<SettingsRow label="Browser permission">
					<PermissionBadge permission={Notification.permission} />
				</SettingsRow>
			)}
		</>
	);
}

/**
 * Permission status badge
 */
function PermissionBadge({ permission }: { permission: NotificationPermission }) {
	const styles = {
		granted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		denied: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		default: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	};

	const labels = {
		granted: "Granted",
		denied: "Denied",
		default: "Not set",
	};

	return (
		<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[permission]}`}>
			{labels[permission]}
		</span>
	);
}
