"use client";

import { Switch } from "@/components/ui/switch";

/** A time picked when All day is switched off; the user can change it right away. */
const DEFAULT_DUE_TIME = "09:00";

interface DueTimeControlsProps {
  /** Local "HH:mm", or undefined for an all-day due date. */
  dueTime: string | undefined;
  onDueTimeChange: (time: string | undefined) => void;
}

/** The All day switch, and a time input while All day is off. */
export function DueTimeControls({ dueTime, onDueTimeChange }: DueTimeControlsProps): React.ReactElement {
  return (
    <div className="mt-2 flex items-center gap-3">
      <label className="inline-flex items-center gap-2 text-small font-medium text-foreground">
        <Switch
          aria-label="All day"
          checked={dueTime === undefined}
          onCheckedChange={(allDay) => onDueTimeChange(allDay ? undefined : DEFAULT_DUE_TIME)}
        />
        All day
      </label>
      {dueTime !== undefined ? (
        <input
          type="time"
          value={dueTime}
          onChange={(e) => { if (e.target.value) onDueTimeChange(e.target.value); }}
          aria-label="Due time"
          className="pointer-coarse:text-base rounded-md border border-border bg-background px-2.5 py-1 text-small font-medium text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        />
      ) : null}
    </div>
  );
}
