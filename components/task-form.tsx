"use client";

import { useState } from "react";
import { z } from "zod";
import { nanoid } from "nanoid";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft, RecurrenceType, Subtask } from "@/lib/types";
import { TogglePill } from "@/components/toggle-pill";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";

interface TaskFormProps {
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
  subtasks: []
};

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

function dateInputToIso(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const iso = new Date(`${value}T00:00:00`).toISOString();
  return iso;
}

export function TaskForm({
  initialValues = defaultValues,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = "Save task"
}: TaskFormProps) {
  const [values, setValues] = useState<TaskDraft>({ ...defaultValues, ...initialValues });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newSubtask, setNewSubtask] = useState("");

  const updateField = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (values.tags && values.tags.includes(trimmed)) return;
    updateField("tags", [...(values.tags || []), trimmed]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    updateField("tags", (values.tags || []).filter(t => t !== tag));
  };

  const addSubtask = () => {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    const subtask: Subtask = {
      id: nanoid(12),
      title: trimmed,
      completed: false
    };
    updateField("subtasks", [...(values.subtasks || []), subtask]);
    setNewSubtask("");
  };

  const removeSubtask = (id: string) => {
    updateField("subtasks", (values.subtasks || []).filter(st => st.id !== id));
  };

  const toggleSubtask = (id: string) => {
    const updated = (values.subtasks || []).map(st =>
      st.id === id ? { ...st, completed: !st.completed } : st
    );
    updateField("subtasks", updated);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const normalized: TaskDraft = {
        ...values,
        dueDate: dateInputToIso(isoToDateInput(values.dueDate))
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
      } else {
        console.error(error);
      }
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
        <Input
          id="due-date"
          type="date"
          value={isoToDateInput(values.dueDate)}
          onChange={(event) => {
            const nextIso = dateInputToIso(event.target.value);
            updateField("dueDate", nextIso);
          }}
        />
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

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag (e.g., work, personal)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button type="button" variant="subtle" onClick={addTag} className="shrink-0">
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        {values.tags && values.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {values.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-accent-foreground"
                  aria-label={`Remove ${tag} tag`}
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {errors.tags ? <p className="text-xs text-red-600">{errors.tags}</p> : null}
      </div>

      <div className="space-y-2">
        <Label>Subtasks</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add subtask"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSubtask();
              }
            }}
          />
          <Button type="button" variant="subtle" onClick={addSubtask} className="shrink-0">
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        {values.subtasks && values.subtasks.length > 0 ? (
          <div className="space-y-1">
            {values.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 rounded-lg border border-card-border bg-background p-2"
              >
                <button
                  type="button"
                  onClick={() => toggleSubtask(subtask.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border hover:border-accent hover:bg-accent/10"
                  aria-label={subtask.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  {subtask.completed ? <CheckIcon className="h-3 w-3 text-accent" /> : null}
                </button>
                <span className={`flex-1 text-sm ${subtask.completed ? "text-foreground-muted line-through" : "text-foreground"}`}>
                  {subtask.title}
                </span>
                <button
                  type="button"
                  onClick={() => removeSubtask(subtask.id)}
                  className="shrink-0 text-foreground-muted hover:text-red-600"
                  aria-label="Remove subtask"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {errors.subtasks ? <p className="text-xs text-red-600">{errors.subtasks}</p> : null}
      </div>

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
