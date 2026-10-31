"use client";

import { DATE_CONFIG, TIME_UNITS } from "@/lib/constants";
import { SNOOZE_PRESETS } from "@/lib/snooze-presets";
import { Field } from "./edit-drawer-fields";

const ENDS_AT = new Intl.DateTimeFormat(DATE_CONFIG.LOCALE, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const CHIP =
  "rounded-full border border-border px-3 py-1.5 text-small font-medium text-foreground-muted transition-colors hover:bg-background-muted";

/**
 * Quiet a task's reminders for a while. The picks are actions, not a selected state:
 * each one sets the end time from now, and Clear removes it. Nothing is written until Save.
 */
export function SnoozeField({
  snoozedUntil,
  onChange,
}: {
  snoozedUntil: string | undefined;
  onChange: (value: string | undefined) => void;
}): React.ReactElement {
  return (
    <Field label="Snooze" as="group">
      <p className="mb-1.5 text-caption text-foreground-muted">
        {snoozedUntil ? `Snoozed until ${ENDS_AT.format(new Date(snoozedUntil))}` : "Not snoozed"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SNOOZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            data-testid={`edit-snooze-${preset.label}`}
            // Distinct from the due-date presets, which also offer Tomorrow and Next week.
            aria-label={`Snooze ${preset.label.toLowerCase()}`}
            onClick={() =>
              onChange(new Date(Date.now() + preset.minutes * TIME_UNITS.MS_PER_MINUTE).toISOString())
            }
            className={CHIP}
          >
            {preset.label}
          </button>
        ))}
        {snoozedUntil ? (
          <button type="button" data-testid="edit-snooze-clear" aria-label="Clear snooze" onClick={() => onChange(undefined)} className={CHIP}>
            Clear
          </button>
        ) : null}
      </div>
    </Field>
  );
}
