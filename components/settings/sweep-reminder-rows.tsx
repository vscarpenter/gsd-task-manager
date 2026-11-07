"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { checkNotificationPermission, requestNotificationPermission } from "@/lib/notifications";
import { readSweepReminder, writeSweepReminder } from "@/lib/preferences/weekly-sweep";
import type { SweepReminder } from "@/lib/weekly-sweep";
import { SettingsRow } from "./shared-components";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const control =
	"touch-target rounded-md border border-border bg-background px-2.5 py-1 text-sm pointer-coarse:text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function DayAndTimeRows({ reminder, onChange }: { reminder: SweepReminder; onChange: (next: SweepReminder) => void }) {
	return (
		<>
			<SettingsRow label="Day">
				<select
					aria-label="Day"
					value={String(reminder.weekday)}
					onChange={(e) => onChange({ ...reminder, weekday: Number(e.target.value) })}
					className={control}
				>
					{WEEKDAYS.map((name, index) => (
						<option key={name} value={String(index + 1)}>{name}</option>
					))}
				</select>
			</SettingsRow>
			<SettingsRow label="Time">
				<input
					type="time"
					aria-label="Time"
					value={reminder.time}
					onChange={(e) => e.target.value && onChange({ ...reminder, time: e.target.value })}
					className={control}
				/>
			</SettingsRow>
		</>
	);
}

/**
 * The weekly sweep reminder: off, or a weekday and time (spec: tasks/spec-weekly-sweep.md
 * section 6). It fires only while GSD is open, within an hour after the time picked.
 */
export function SweepReminderRows() {
	const [reminder, setReminder] = useState<SweepReminder>(readSweepReminder);

	const save = (next: SweepReminder) => {
		setReminder(next);
		writeSweepReminder(next);
	};
	// Turning off keeps the day and time, so turning it back on restores them.
	const toggle = async (enabled: boolean) => {
		if (enabled && checkNotificationPermission() === "default") await requestNotificationPermission();
		save({ ...reminder, enabled });
	};

	return (
		<>
			<SettingsRow
				label="Weekly sweep reminder"
				description="Works while GSD is open, within an hour after the time you pick. If GSD is closed then, it doesn't fire."
				state={reminder.enabled}
			>
				<Switch aria-label="Weekly sweep reminder" checked={reminder.enabled} onCheckedChange={toggle} />
			</SettingsRow>
			{reminder.enabled ? <DayAndTimeRows reminder={reminder} onChange={save} /> : null}
		</>
	);
}
