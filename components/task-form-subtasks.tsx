"use client";

import { useState } from "react";
import { generateId } from "@/lib/id-generator";
import type { Subtask } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";

interface TaskFormSubtasksProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
  error?: string;
}

/**
 * Subtasks section for task form
 *
 * Allows adding, removing, and toggling subtasks within a task
 */
export function TaskFormSubtasks({ subtasks, onChange, error }: TaskFormSubtasksProps) {
  const [newSubtask, setNewSubtask] = useState("");

  const addSubtask = () => {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    const subtask: Subtask = {
      id: generateId(),
      title: trimmed,
      completed: false
    };
    onChange([...subtasks, subtask]);
    setNewSubtask("");
  };

  const removeSubtask = (id: string) => {
    onChange(subtasks.filter(subtask => subtask.id !== id));
  };

  const toggleSubtask = (id: string) => {
    const updated = subtasks.map(subtask =>
      subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask
    );
    onChange(updated);
  };

  return (
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
      {subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map((subtask) => (
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
                {subtask.completed && <CheckIcon className="h-3 w-3 text-accent" />}
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
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
