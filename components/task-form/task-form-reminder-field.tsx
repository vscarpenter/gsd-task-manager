"use client";

import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "./validation";

interface TaskFormReminderFieldProps {
  notifyBefore: number | undefined;
  notificationEnabled: boolean | undefined;
  onNotifyBeforeChange: (value: number | undefined) => void;
  onNotificationEnabledChange: (value: boolean) => void;
}

export function TaskFormReminderField({ notifyBefore, notificationEnabled, onNotifyBeforeChange, onNotificationEnabledChange }: TaskFormReminderFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="notifyBefore">Reminder</Label>
      <select
        id="notifyBefore"
        value={notifyBefore ?? 15}
        onChange={(e) => onNotifyBeforeChange(e.target.value === "" ? undefined : Number(e.target.value))}
        disabled={notificationEnabled === false}
        className={SELECT_CLASS}
      >
        <option value="0">At due time</option>
        <option value="5">5 minutes before</option>
        <option value="15">15 minutes before</option>
        <option value="30">30 minutes before</option>
        <option value="60">1 hour before</option>
        <option value="120">2 hours before</option>
        <option value="1440">1 day before</option>
      </select>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="notificationEnabled"
          checked={notificationEnabled ?? true}
          onChange={(e) => onNotificationEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-input text-blue-600 focus:ring-2 focus:ring-blue-500"
        />
        <label htmlFor="notificationEnabled" className="text-xs text-foreground-muted cursor-pointer">
          Enable notification for this task
        </label>
      </div>
    </div>
  );
}
