import { useState } from "react";
import { z } from "zod";
import type { TaskDraft } from "@/lib/types";
import {
  taskDraftSchema,
  type FormErrors,
  isoToDateInput,
  isoToTimeInput,
  dateTimeInputToIso
} from "./validation";

export const defaultValues: TaskDraft = {
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

export interface UseTaskFormProps {
  initialValues?: TaskDraft;
  onSubmit: (task: TaskDraft) => Promise<void> | void;
  onCancel: () => void;
}

export function useTaskForm({
  initialValues = defaultValues,
  onSubmit,
  onCancel
}: UseTaskFormProps) {
  const [values, setValues] = useState<TaskDraft>({
    ...defaultValues,
    ...initialValues
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>(
    isoToTimeInput(initialValues.dueDate)
  );

  const updateField = <Key extends keyof TaskDraft>(
    key: Key,
    value: TaskDraft[Key]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateTime = (newTime: string) => {
    setSelectedTime(newTime);
    if (values.dueDate) {
      const nextIso = dateTimeInputToIso(
        isoToDateInput(values.dueDate),
        newTime
      );
      updateField("dueDate", nextIso);
    }
  };

  const updateDate = (newDate: string) => {
    const nextIso = dateTimeInputToIso(newDate, selectedTime);
    updateField("dueDate", nextIso);
  };

  const parseValidationErrors = (error: z.ZodError): FormErrors => {
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
    return fieldErrors;
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
        setErrors(parseValidationErrors(error));
      }
      // Note: onSubmit handler in parent component will handle non-validation errors
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onCancel();
  };

  return {
    values,
    errors,
    submitting,
    selectedTime,
    updateField,
    updateTime,
    updateDate,
    handleSubmit
  };
}
