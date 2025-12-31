"use client";

import type { TaskDraft, RecurrenceType } from "@/lib/types";
import { TogglePill } from "@/components/toggle-pill";
import { TaskFormTags } from "@/components/task-form-tags";
import { TaskFormSubtasks } from "@/components/task-form-subtasks";
import { TaskFormDependencies } from "@/components/task-form-dependencies";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTaskForm } from "./use-task-form";
import { TIME_OPTIONS, isoToDateInput } from "./validation";

interface TaskFormProps {
  taskId?: string; // ID of task being edited (undefined for new tasks)
  initialValues?: TaskDraft;
  onSubmit: (task: TaskDraft) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
  submitLabel?: string;
}

export function TaskForm({
  taskId,
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = "Save task"
}: TaskFormProps) {
  const {
    values,
    errors,
    submitting,
    selectedTime,
    updateField,
    updateTime,
    updateDate,
    handleSubmit
  } = useTaskForm({ initialValues, onSubmit, onCancel });

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
            onChange={(event) => updateDate(event.target.value)}
          />
          <div className="space-y-1">
            <select
              id="due-time"
              value={selectedTime}
              onChange={(event) => updateTime(event.target.value)}
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

      <div className="grid gap-3 md:grid-cols-2">
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
          <p className="text-xs text-foreground-muted">Create new instance on completion</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="estimatedMinutes">Time Estimate</Label>
          <select
            id="estimatedMinutes"
            value={values.estimatedMinutes ?? ""}
            onChange={(event) => updateField("estimatedMinutes", event.target.value === "" ? undefined : Number(event.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No estimate</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
            <option value="240">4 hours</option>
            <option value="480">8 hours (1 day)</option>
            <option value="960">2 days</option>
            <option value="2400">5 days</option>
          </select>
          <p className="text-xs text-foreground-muted">Helps track time vs. estimate</p>
        </div>
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
