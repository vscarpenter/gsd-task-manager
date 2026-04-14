"use client";

import { TogglePill } from "@/components/toggle-pill";

interface TaskFormQuadrantPickerProps {
  urgent: boolean;
  important: boolean;
  onUrgentChange: (value: boolean) => void;
  onImportantChange: (value: boolean) => void;
}

export function TaskFormQuadrantPicker({ urgent, important, onUrgentChange, onImportantChange }: TaskFormQuadrantPickerProps) {
  return (
    <div className="grid gap-3">
      <div className="space-y-3 rounded-3xl border border-border/70 bg-background-muted/60 p-4 shadow-sm shadow-black/[0.02]">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Urgency</p>
          <p className="text-sm font-medium text-foreground">Decide whether this needs attention now.</p>
        </div>
        <div className="flex gap-2">
          <TogglePill label="Urgent" active={urgent} variant="blue" onSelect={() => onUrgentChange(true)} />
          <TogglePill label="Not urgent" active={!urgent} variant="blue" onSelect={() => onUrgentChange(false)} />
        </div>
      </div>
      <div className="space-y-3 rounded-3xl border border-border/70 bg-background-muted/60 p-4 shadow-sm shadow-black/[0.02]">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Importance</p>
          <p className="text-sm font-medium text-foreground">Keep the long-term value of the task explicit.</p>
        </div>
        <div className="flex gap-2">
          <TogglePill label="Important" active={important} variant="amber" onSelect={() => onImportantChange(true)} />
          <TogglePill label="Not important" active={!important} variant="amber" onSelect={() => onImportantChange(false)} />
        </div>
      </div>
    </div>
  );
}
