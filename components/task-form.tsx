"use client";

import { useState } from "react";
import { z } from "zod";
import { taskDraftSchema } from "@/lib/schema";
import type { TaskDraft } from "@/lib/types";
import { TogglePill } from "@/components/toggle-pill";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
}

const defaultValues: TaskDraft = {
  title: "",
  description: "",
  urgent: true,
  important: true,
  dueDate: undefined
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
