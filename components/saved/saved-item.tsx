"use client";

import { useEffect, useRef, type RefObject } from "react";
import { BookmarkIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskDescription } from "@/components/task-description";
import type { QuadrantId, TaskRecord } from "@/lib/types";
import { useSavedItem } from "./use-saved-item";
import { SavedItemEditor } from "./saved-item-editor";

export interface SavedItemProps {
  task: TaskRecord;
  onNotes: (task: TaskRecord, notes: string) => Promise<boolean>;
  onReturn: (task: TaskRecord, quadrant: QuadrantId, dueDate?: string) => Promise<boolean>;
  onDelete: (task: TaskRecord) => Promise<void>;
}


export function SavedItem(props: SavedItemProps) {
  const { task, onDelete } = props;
  const editor = useSavedItem(props);
  const id = `saved-${task.id}`;
  const actionRef = useRef<HTMLButtonElement>(null);
  const previousMode = useRef(editor.mode);
  useEffect(() => {
    if (previousMode.current !== "read" && editor.mode === "read") actionRef.current?.focus();
    previousMode.current = editor.mode;
  }, [editor.mode]);
  return (
    <li id={task.id} data-testid="saved-item" className="scroll-mt-24 border-b border-border py-6 first:pt-0 last:border-b-0">
      <article aria-labelledby={`${id}-title`}>
        <div className="flex items-start gap-3">
          <BookmarkIcon className="mt-1 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="break-words text-h3 text-foreground">{task.title}</h2>
            {task.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground-muted"><TaskDescription description={task.description} /></p> : null}
            {task.tags.length ? <p className="mt-3 break-words text-xs text-foreground-muted">{task.tags.map((tag) => `#${tag}`).join(" ")}</p> : null}
            <SavedItemActions task={task} editor={editor} onDelete={onDelete} actionRef={actionRef} />
          </div>
        </div>
        {editor.mode !== "read" ? <SavedItemEditor task={task} editor={editor} /> : null}
      </article>
    </li>
  );
}

function SavedItemActions({ task, editor, onDelete, actionRef }: { task: TaskRecord; editor: ReturnType<typeof useSavedItem>; onDelete: SavedItemProps["onDelete"]; actionRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button ref={actionRef} variant="ghost" className="touch-target gap-2 text-sm" aria-expanded={editor.mode === "notes"} onClick={() => editor.open("notes")} disabled={editor.busy}>
        <PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />Edit notes
      </Button>
      <Button variant="ghost" className="touch-target gap-2 text-sm" aria-expanded={editor.mode === "return"} onClick={() => editor.open("return")} disabled={editor.busy}>
        <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden="true" />Return to matrix
      </Button>
      <Button variant="ghost" className="touch-target text-foreground-muted" aria-label={`Delete ${task.title}`} disabled={editor.busy} onClick={() => { editor.setBusy(true); void onDelete(task).finally(() => editor.setBusy(false)); }}>
        <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
