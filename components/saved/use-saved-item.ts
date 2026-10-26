"use client";

import { useState, type FormEvent } from "react";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import type { SavedItemProps } from "./saved-item";

type Mode = "read" | "notes" | "return";

export function useSavedItem({ task, onNotes, onReturn }: SavedItemProps) {
  const [mode, setMode] = useState<Mode>("read");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(task.description);
  const [quadrant, setQuadrant] = useState<QuadrantId>(task.quadrant);
  const [dueDate, setDueDate] = useState(task.dueDate?.slice(0, 10) ?? "");
  const close = () => setMode("read");
  const open = (next: Mode) => {
    setNotes(task.description);
    setQuadrant(task.quadrant);
    setDueDate(task.dueDate?.slice(0, 10) ?? "");
    setMode(next);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const succeeded = mode === "notes" ? await onNotes(task, notes.trim()) : await onReturn(task, quadrant, reviewedDueDate(task, dueDate));
      if (succeeded) close();
    } finally { setBusy(false); }
  };
  return { mode, busy, setBusy, notes, setNotes, quadrant, setQuadrant, dueDate, setDueDate, open, close, submit };
}

function reviewedDueDate(task: TaskRecord, date: string): string | undefined {
  if (date === task.dueDate?.slice(0, 10)) return task.dueDate;
  return date ? new Date(`${date}T12:00:00`).toISOString() : undefined;
}
