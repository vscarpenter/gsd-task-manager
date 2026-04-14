"use client";

import { Button } from "@/components/ui/button";

interface TaskFormActionsProps {
  onDelete?: () => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
}

export function TaskFormActions({ onDelete, onCancel, submitting, submitLabel }: TaskFormActionsProps) {
  return (
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
  );
}
