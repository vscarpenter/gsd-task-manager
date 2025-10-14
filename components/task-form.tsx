"use client";

import { useState } from "react";
import { z } from "zod";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, RecurrenceType } from "@/lib/types";
import { TogglePill } from "@/components/toggle-pill";
import { TaskFormTags } from "@/components/task-form-tags";
import { TaskFormSubtasks } from "@/components/task-form-subtasks";
import { TaskFormDependencies } from "@/components/task-form-dependencies";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TaskFormProps {
  taskId?: string; // ID of task being edited (undefined for new tasks)
  initialValues?: TaskDraft;
  onSubmit: (task: TaskDraft) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
  submitLabel?: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  dueDate?: string;
  tags?: string;
  subtasks?: string;
}

const defaultValues: TaskDraft = {
  title: "",
  description: "",
  urgent: true,
  important: true,
  dueDate: undefined,
  recurrence: "none",
  tags: [],
  subtasks: [],
  dependencies: [],
  notifyBefore: 15, // Default to 15 minutes before
  notificationEnabled: true
};

// Generate time options in 15-minute increments with 12-hour AM/PM format
function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h24 = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      const value = `${h24}:${m}`;

      // Convert to 12-hour format
      const period = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const label = `${h12}:${m} ${period}`;

      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function isoToDateInput(isoValue?: string): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function isoToTimeInput(isoValue?: string): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // Get local time in HH:MM format
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function dateTimeInputToIso(dateValue?: string, timeValue?: string): string | undefined {
  if (!dateValue) {
    return undefined;
  }
  // If time is provided, use it; otherwise default to start of day
  const time = timeValue || "00:00";
  const iso = new Date(`${dateValue}T${time}:00`).toISOString();
  return iso;
}

export function TaskForm({
  taskId,
  initialValues = defaultValues,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = "Save task"
}: TaskFormProps) {
  const [values, setValues] = useState<TaskDraft>({ ...defaultValues, ...initialValues });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>(isoToTimeInput(initialValues.dueDate));

  const updateField = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const normalized: TaskDraft = {
        ...values,
        dueDate: dateTimeInputToIso(isoToDateInput(values.dueDate), selectedTime)
      };
      const validated = taskDraftSchema.parse({
        ...normalized,
        description: normalized.description ?? ""
      });
      await onSubmit(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: FormErrors = {};
        for (const issue of error.issues) {
          if (issue.path[0] === "title") {
            fieldErrors.title = issue.message;
          }
          if (issue.path[0] === "description") {
            fieldErrors.description = issue.message;
          }
          if (issue.path[0] === "dueDate") {
            fieldErrors.dueDate = "Please choose a valid date";
          }
        }
        setErrors(fieldErrors);
      }
      // Note: onSubmit handler in parent component will handle non-validation errors
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onCancel();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Add a task name"
          required
          autoFocus
        />
        {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Outline the next meaningful action"
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
        />
        {errors.description ? (
          <p className="text-xs text-red-600">{errors.description}</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-card-border bg-background-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">Urgency</p>
          <div className="flex gap-2">
            <TogglePill
              label="Urgent"
              active={values.urgent}
              variant="blue"
              onSelect={() => updateField("urgent", true)}
            />
            <TogglePill
              label="Not urgent"
              active={!values.urgent}
              variant="blue"
              onSelect={() => updateField("urgent", false)}
            />
          </div>
        </div>
        <div className="space-y-2 rounded-2xl border border-card-border bg-background-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground">Importance</p>
          <div className="flex gap-2">
            <TogglePill
              label="Important"
              active={values.important}
              variant="amber"
              onSelect={() => updateField("important", true)}
            />
            <TogglePill
              label="Not important"
              active={!values.important}
              variant="amber"
              onSelect={() => updateField("important", false)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="due-date">Due date</Label>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            id="due-date"
            type="date"
            value={isoToDateInput(values.dueDate)}
            onChange={(event) => {
              const nextIso = dateTimeInputToIso(event.target.value, selectedTime);
              updateField("dueDate", nextIso);
            }}
          />
          <div className="space-y-1">
            <select
              id="due-time"
              value={selectedTime}
              onChange={(event) => {
                setSelectedTime(event.target.value);
                // Update the dueDate with the new time if a date is already set
                if (values.dueDate) {
                  const nextIso = dateTimeInputToIso(isoToDateInput(values.dueDate), event.target.value);
                  updateField("dueDate", nextIso);
                }
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">No specific time</option>
              {TIME_OPTIONS.map((timeOption) => (
                <option key={timeOption.value} value={timeOption.value}>
                  {timeOption.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {errors.dueDate ? <p className="text-xs text-red-600">{errors.dueDate}</p> : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="recurrence">Recurrence</Label>
        <select
          id="recurrence"
          value={values.recurrence}
          onChange={(event) => updateField("recurrence", event.target.value as RecurrenceType)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <p className="text-xs text-foreground-muted">When completed, create a new instance automatically</p>
      </div>

      {values.dueDate && (
        <div className="space-y-1">
          <Label htmlFor="notifyBefore">Reminder</Label>
          <select
            id="notifyBefore"
            value={values.notifyBefore ?? 15}
            onChange={(event) => updateField("notifyBefore", event.target.value === "" ? undefined : Number(event.target.value))}
            disabled={values.notificationEnabled === false}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              checked={values.notificationEnabled ?? true}
              onChange={(event) => updateField("notificationEnabled", event.target.checked)}
              className="h-4 w-4 rounded border-input text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="notificationEnabled" className="text-xs text-foreground-muted cursor-pointer">
              Enable notification for this task
            </label>
          </div>
        </div>
      )}

      <TaskFormTags
        tags={values.tags || []}
        onChange={(tags) => updateField("tags", tags)}
        error={errors.tags}
      />

      <TaskFormSubtasks
        subtasks={values.subtasks || []}
        onChange={(subtasks) => updateField("subtasks", subtasks)}
        error={errors.subtasks}
      />

      <TaskFormDependencies
        taskId={taskId}
        dependencies={values.dependencies || []}
        onChange={(dependencies) => updateField("dependencies", dependencies)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-sm text-red-600 hover:text-red-700"
            onClick={() => onDelete()}
          >
            Delete task
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
