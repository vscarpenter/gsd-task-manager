"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { quadrants } from "@/lib/quadrants";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import type { useSavedItem } from "./use-saved-item";

type Editor = ReturnType<typeof useSavedItem>;
const CONTROL = "touch-target w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function SavedItemEditor({ task, editor }: { task: TaskRecord; editor: Editor }) {
  const id = `saved-${task.id}`;
  return (
    <form onSubmit={editor.submit} className="mt-4 space-y-4 rounded-lg border border-border bg-background-muted p-4 sm:ml-7">
      {editor.mode === "notes" ? <NotesField id={id} editor={editor} /> : <ReturnFields id={id} editor={editor} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={editor.busy}>{editor.busy ? "Saving…" : editor.mode === "notes" ? "Save notes" : "Add to matrix"}</Button>
        <Button type="button" variant="ghost" disabled={editor.busy} onClick={editor.close}>Cancel</Button>
      </div>
    </form>
  );
}

function NotesField({ id, editor }: { id: string; editor: Editor }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div>
      <label htmlFor={`${id}-notes`} className="text-sm font-medium">Notes and links</label>
      <p id={`${id}-hint`} className="my-2 text-xs text-foreground-muted">Keep the original link here and add a short annotation.</p>
      <textarea ref={inputRef} id={`${id}-notes`} aria-describedby={`${id}-hint ${id}-count`} className={CONTROL} rows={4} maxLength={SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH} value={editor.notes} onChange={(event) => editor.setNotes(event.target.value)} disabled={editor.busy} />
      <p id={`${id}-count`} className="mt-1 text-right text-xs tabular-nums text-foreground-muted">{editor.notes.length}/{SCHEMA_LIMITS.TASK_DESCRIPTION_MAX_LENGTH}</p>
    </div>
  );
}

function ReturnFields({ id, editor }: { id: string; editor: Editor }) {
  const inputRef = useRef<HTMLSelectElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-quadrant`} className="mb-2 block text-sm font-medium">Quadrant</label>
        <select ref={inputRef} id={`${id}-quadrant`} className={CONTROL} value={editor.quadrant} onChange={(event) => editor.setQuadrant(event.target.value as QuadrantId)} disabled={editor.busy}>
          {quadrants.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-due`} className="mb-2 block text-sm font-medium">Due date (optional)</label>
        <input id={`${id}-due`} type="date" className={CONTROL} value={editor.dueDate} onChange={(event) => editor.setDueDate(event.target.value)} aria-describedby={`${id}-date-hint`} disabled={editor.busy} />
        <p id={`${id}-date-hint`} className="mt-2 text-xs text-foreground-muted">Review or clear the old date before returning.</p>
      </div>
    </div>
  );
}
