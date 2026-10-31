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

	return (
		<>
			<PushNotificationsRow enabled={settings.enabled} onToggle={onNotificationToggle} />

			{/* Reminder, sound, quiet hours - only meaningful while notifications fire */}
			{settings.enabled && (
				<>
					<SettingsSelectRow
						label="Default reminder"
						value={reminderLabel(settings.defaultReminder)}
						options={reminderOptions(settings.defaultReminder)}
						onChange={onDefaultReminderChange}
					/>
					<SoundAndQuietHoursRows
						settings={settings}
						onSoundToggle={onSoundToggle}
						onQuietHoursToggle={onQuietHoursToggle}
						onQuietHoursChange={onQuietHoursChange}
					/>
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

/** Pluralize a unit: 1 stays singular. */
function unit(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Names a stored offset the select does not list, without rounding it: the same
 * ordered rules as Android's `ReminderLabel.of`, so 90 reads "90 minutes" and 2160
 * reads "36 hours".
 */
function offListLabel(minutes: number): string {
	if (minutes === 0) return "At time";
	if (minutes < 60 || minutes % 60 !== 0) return unit(minutes, "minute");
	if (minutes < 1440 || minutes % 1440 !== 0) return unit(minutes / 60, "hour");
	return unit(minutes / 1440, "day");
}

/**
 * The select's options, plus the stored offset when the list lacks it. A reminder synced
 * from a native client can be off-list; render it as stored, never snap it to another value.
 */
function reminderOptions(defaultReminder: number): { value: string; label: string }[] {
	const stored = defaultReminder.toString();
	if (REMINDER_OPTIONS.some((opt) => opt.value === stored)) return REMINDER_OPTIONS;
	return [...REMINDER_OPTIONS, { value: stored, label: offListLabel(defaultReminder) }].sort(
		(a, b) => Number(a.value) - Number(b.value),
	);
}

/** Label for the stored default-reminder offset. */
function reminderLabel(defaultReminder: number): string {
	return (
		reminderOptions(defaultReminder).find((opt) => opt.value === defaultReminder.toString())?.label ??
		offListLabel(defaultReminder)
	);
}

/** The master switch for notifications. */
function PushNotificationsRow({
	enabled,
	onToggle,
}: {
	enabled: boolean;
	onToggle: () => Promise<void>;
}) {
	return (
		<SettingsRow
			label="Push notifications"
			description="Get reminded about tasks"
			state={enabled}
		>
			<Switch
				aria-label="Push notifications"
				checked={enabled}
				onCheckedChange={onToggle}
			/>
		</SettingsRow>
	);
}

/** The sound switch, then the quiet-hours switch with its window rows. */
function SoundAndQuietHoursRows({
	settings,
	onSoundToggle,
	onQuietHoursToggle,
	onQuietHoursChange,
}: Pick<
	NotificationSettingsProps,
	"onSoundToggle" | "onQuietHoursToggle" | "onQuietHoursChange"
> & { settings: NotificationSettings }) {
	return (
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
			<QuietHoursRows
				settings={settings}
				onQuietHoursToggle={onQuietHoursToggle}
				onQuietHoursChange={onQuietHoursChange}
			/>
		</>
	);
}

/** The quiet-hours switch, revealing the window's From/To rows when on. */
function QuietHoursRows({
	settings,
	onQuietHoursToggle,
	onQuietHoursChange,
}: Pick<NotificationSettingsProps, "onQuietHoursToggle" | "onQuietHoursChange"> & {
	settings: NotificationSettings;
}) {
	// The checker treats quiet hours as active only when both edges exist, so
	// the switch mirrors that exact condition rather than a separate flag.
	const quietHoursOn = Boolean(settings.quietHoursStart && settings.quietHoursEnd);

	return (
		<>
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
