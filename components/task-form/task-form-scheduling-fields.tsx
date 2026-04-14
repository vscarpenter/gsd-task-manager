"use client";

import type { RecurrenceType } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "./validation";

const ESTIMATE_OPTIONS = [
  { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" }, { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" }, { value: "120", label: "2 hours" },
  { value: "180", label: "3 hours" }, { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours (1 day)" }, { value: "960", label: "2 days" },
  { value: "2400", label: "5 days" },
];

interface RecurrenceFieldProps {
  recurrence: RecurrenceType;
  onChange: (value: RecurrenceType) => void;
}

export function TaskFormRecurrenceField({ recurrence, onChange }: RecurrenceFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="recurrence">Recurrence</Label>
      <select id="recurrence" value={recurrence} onChange={(e) => onChange(e.target.value as RecurrenceType)} className={SELECT_CLASS}>
        <option value="none">None</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <p className="text-xs text-foreground-muted">Create new instance on completion</p>
    </div>
  );
}

interface TimeEstimateFieldProps {
  estimatedMinutes: number | undefined;
  onChange: (value: number | undefined) => void;
}

export function TaskFormTimeEstimateField({ estimatedMinutes, onChange }: TimeEstimateFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="estimatedMinutes">Time Estimate</Label>
      <select
        id="estimatedMinutes"
        value={estimatedMinutes ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className={SELECT_CLASS}
      >
        <option value="">No estimate</option>
        {ESTIMATE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <p className="text-xs text-foreground-muted">Helps track time vs. estimate</p>
    </div>
  );
}
