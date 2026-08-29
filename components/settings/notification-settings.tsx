"use client";

import { Switch } from "@/components/ui/switch";
import type { NotificationSettings } from "@/lib/types";
import { SettingsRow, SettingsSelectRow } from "./shared-components";

interface NotificationSettingsProps {
	settings: NotificationSettings | null;
	onNotificationToggle: () => Promise<void>;
	onDefaultReminderChange: (value: string) => Promise<void>;
	onSoundToggle: () => Promise<void>;
	onQuietHoursToggle: () => Promise<void>;
	onQuietHoursChange: (which: "start" | "end", value: string) => Promise<void>;
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
	onSoundToggle,
	onQuietHoursToggle,
	onQuietHoursChange,
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

	// The checker treats quiet hours as active only when both edges exist, so
	// the switch mirrors that exact condition rather than a separate flag.
	const quietHoursOn = Boolean(settings.quietHoursStart && settings.quietHoursEnd);

	return (
		<>
			{/* Enable Notifications Row */}
			<SettingsRow
				label="Push notifications"
				description="Get reminded about tasks"
				state={settings.enabled}
			>
				<Switch
					aria-label="Push notifications"
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

			{/* Sound + quiet hours - only meaningful while notifications fire */}
			{settings.enabled && (
				<>
					<SettingsRow
						label="Sound"
						description="Play a sound with each notification"
						state={settings.soundEnabled}
					>
						<Switch
							aria-label="Sound"
							checked={settings.soundEnabled}
							onCheckedChange={onSoundToggle}
						/>
					</SettingsRow>

					<SettingsRow
						label="Quiet hours"
						description="Hold notifications during a daily window"
						state={quietHoursOn}
					>
						<Switch
							aria-label="Quiet hours"
							checked={quietHoursOn}
							onCheckedChange={onQuietHoursToggle}
						/>
					</SettingsRow>

					{quietHoursOn && (
						<>
							<QuietHoursTimeRow
								label="From"
								value={settings.quietHoursStart ?? ""}
								onChange={(value) => onQuietHoursChange("start", value)}
							/>
							<QuietHoursTimeRow
								label="To"
								value={settings.quietHoursEnd ?? ""}
								onChange={(value) => onQuietHoursChange("end", value)}
							/>
						</>
					)}
				</>
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
 * One edge of the quiet-hours window as an iOS-style row with a native time
 * input — the same disclosure position SettingsSelectRow puts its control in.
 */
function QuietHoursTimeRow({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px] cursor-pointer">
			<span className="text-sm font-medium text-foreground">{label}</span>
			<input
				type="time"
				aria-label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="bg-transparent text-sm text-foreground-muted text-right cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xs"
			/>
		</label>
	);
}

/**
 * Permission status badge
 */
function PermissionBadge({ permission }: { permission: NotificationPermission }) {
	const variant = {
		granted: "badge-success",
		denied: "badge-danger",
		default: "badge-warning",
	}[permission];

	const labels = {
		granted: "Granted",
		denied: "Denied",
		default: "Not set",
	};

	return (
		<span className={`badge ${variant}`}>
			{labels[permission]}
		</span>
	);
}
