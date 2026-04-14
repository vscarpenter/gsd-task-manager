"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIME_OPTIONS, isoToDateInput, SELECT_CLASS } from "./validation";

interface TaskFormDueDateFieldProps {
  dueDate: string | undefined;
  selectedTime: string;
  error?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export function TaskFormDueDateField({ dueDate, selectedTime, error, onDateChange, onTimeChange }: TaskFormDueDateFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="due-date">Due date</Label>
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          id="due-date"
          type="date"
          value={isoToDateInput(dueDate)}
          onChange={(event) => onDateChange(event.target.value)}
        />
        <div className="space-y-1">
          <label htmlFor="due-time" className="sr-only">Time</label>
          <select id="due-time" value={selectedTime} onChange={(event) => onTimeChange(event.target.value)} className={SELECT_CLASS}>
            <option value="">No specific time</option>
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
