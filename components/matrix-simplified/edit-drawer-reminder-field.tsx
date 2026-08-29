"use client";

import { cn } from "@/lib/utils";
import { Field } from "./edit-drawer-fields";

/**
 * The canonical reminder offsets — the same five the notification settings offer and the
 * same five the iOS client's `NotificationSettings.allowedReminders` defines.
 */
const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 1440, label: "1 day" },
];

/** "5m" / "45m" / "3h" / "2 days" — only used for a value this control does not list. */
function offListLabel(minutes: number): string {
  if (minutes === 0) return "At time";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  const days = Math.round(minutes / 1440);
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * When to remind, per task.
 *
 * `notifyBefore` and `notificationEnabled` were in the schema, the sync wire model and the
 * notification checker, but no control ever wrote them — so a reminder set on the iOS
 * client was invisible here and a web user could only change the global default.
 *
 * The iOS editor additionally offers "At time of event" and 5 minutes. Rather than snap a
 * value this control does not list, an off-list stored offset is rendered as its own
 * option, so editing an iOS-created task never silently rewrites the user's choice.
 */
export function ReminderField({
  minutes,
  onChange,
}: {
  minutes: number | null;
  onChange: (value: number | null) => void;
}): React.ReactElement {
  const isOffList = minutes !== null && !REMINDER_OPTIONS.some((o) => o.value === minutes);
  const options = isOffList
    ? [...REMINDER_OPTIONS, { value: minutes, label: offListLabel(minutes) }].sort(
        (a, b) => a.value - b.value
      )
    : REMINDER_OPTIONS;

  return (
    <Field label="Reminder" as="group">
      <div className="flex flex-wrap gap-1.5">
        <ReminderOption
          label="Off"
          active={minutes === null}
          onClick={() => onChange(null)}
        />
        {options.map((option) => (
          <ReminderOption
            key={option.value}
            label={option.label}
            active={option.value === minutes}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
      <p className="mt-1.5 text-caption text-foreground-muted">
        Reminders need a due date and browser notification permission.
      </p>
    </Field>
  );
}

function ReminderOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      data-testid={`edit-reminder-${label}`}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-foreground-muted hover:bg-background-muted"
      )}
    >
      {label}
    </button>
  );
}
