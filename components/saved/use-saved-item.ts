"use client";

import { useState, type FormEvent } from "react";
import { localDayOf } from "@/lib/due-date-presets";
import { onDate } from "@/lib/due-time";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import type { SavedItemProps } from "./saved-item";

type Mode = "read" | "notes" | "return";

/** The local day for the date input; slicing the ISO string gave the UTC day. */
const formDay = (task: TaskRecord): string => (task.dueDate ? localDayOf(task.dueDate) : "");

export function useSavedItem({ task, onNotes, onReturn }: SavedItemProps) {
  const [mode, setMode] = useState<Mode>("read");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(task.description);
  const [quadrant, setQuadrant] = useState<QuadrantId>(task.quadrant);
  const [dueDate, setDueDate] = useState(formDay(task));
  const close = () => setMode("read");
  const open = (next: Mode) => {
    setNotes(task.description);
    setQuadrant(task.quadrant);
    setDueDate(formDay(task));
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
  if (date === formDay(task)) return task.dueDate;
  // A new day keeps the task's time of day, or stays all day, as the edit drawer does.
  return date ? onDate(task.dueDate, date) : undefined;
}
