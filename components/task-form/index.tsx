"use client";

import type { TaskDraft } from "@/lib/types";
import { TaskFormTags } from "@/components/task-form-tags";
import { TaskFormSubtasks } from "@/components/task-form-subtasks";
import { TaskFormDependencies } from "@/components/task-form-dependencies";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTaskForm } from "./use-task-form";
import { TaskFormQuadrantPicker } from "./task-form-quadrant-picker";
import { TaskFormDueDateField } from "./task-form-due-date-field";
import { TaskFormRecurrenceField, TaskFormTimeEstimateField } from "./task-form-scheduling-fields";
import { TaskFormReminderField } from "./task-form-reminder-field";
import { TaskFormActions } from "./task-form-actions";

interface TaskFormProps {
  taskId?: string; // ID of task being edited (undefined for new tasks)
  initialValues?: TaskDraft;
  onSubmit: (task: TaskDraft) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
  submitLabel?: string;
}

export function TaskForm({ taskId, initialValues, onSubmit, onCancel, onDelete, submitLabel = "Save task" }: TaskFormProps) {
  const { values, errors, submitting, selectedTime, updateField, updateTime, updateDate, handleSubmit } =
    useTaskForm({ initialValues, onSubmit, onCancel });

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(e) => updateField("title", e.target.value)}
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
          onChange={(e) => updateField("description", e.target.value)}
        />
        {errors.description ? <p className="text-xs text-red-600">{errors.description}</p> : null}
      </div>

      <TaskFormQuadrantPicker
        urgent={values.urgent}
        important={values.important}
        onUrgentChange={(v) => updateField("urgent", v)}
        onImportantChange={(v) => updateField("important", v)}
      />

      <TaskFormDueDateField
        dueDate={values.dueDate}
        selectedTime={selectedTime}
        error={errors.dueDate}
        onDateChange={updateDate}
        onTimeChange={updateTime}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <TaskFormRecurrenceField
          recurrence={values.recurrence ?? "none"}
          onChange={(v) => updateField("recurrence", v)}
        />
        <TaskFormTimeEstimateField
          estimatedMinutes={values.estimatedMinutes}
          onChange={(v) => updateField("estimatedMinutes", v)}
        />
      </div>

      {values.dueDate && (
        <TaskFormReminderField
          notifyBefore={values.notifyBefore}
          notificationEnabled={values.notificationEnabled}
          onNotifyBeforeChange={(v) => updateField("notifyBefore", v)}
          onNotificationEnabledChange={(v) => updateField("notificationEnabled", v)}
        />
      )}

      <TaskFormTags tags={values.tags || []} onChange={(tags) => updateField("tags", tags)} error={errors.tags} />
      <TaskFormSubtasks subtasks={values.subtasks || []} onChange={(subtasks) => updateField("subtasks", subtasks)} error={errors.subtasks} />
      <TaskFormDependencies taskId={taskId} dependencies={values.dependencies || []} onChange={(deps) => updateField("dependencies", deps)} />

      {errors.general ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">{errors.general}</p>
      ) : null}

      <TaskFormActions onDelete={onDelete} onCancel={onCancel} submitting={submitting} submitLabel={submitLabel} />
    </form>
  );
}
