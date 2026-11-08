"use client";

import { useEffect, useRef } from "react";
import { SavedItemEditor } from "@/components/saved/saved-item-editor";
import { useSavedItem } from "@/components/saved/use-saved-item";
import type { QuadrantId, TaskRecord } from "@/lib/types";

interface SweepReturnFormProps {
  task: TaskRecord;
  /** Resolves true when the item went back to the matrix. */
  onReturn: (quadrant: QuadrantId, dueDate?: string) => Promise<boolean>;
  onCancel: () => void;
}

/**
 * Return to matrix, with the quadrant and due date choices the Saved page gives it: the
 * same form and the same hook, opened straight onto the return step. Closing it any way,
 * Cancel or a finished return, tells the card to put its panel away.
 */
export function SweepReturnForm({ task, onReturn, onCancel }: SweepReturnFormProps) {
  const editor = useSavedItem({ task, onNotes: async () => false, onReturn: (_task, quadrant, dueDate) => onReturn(quadrant, dueDate), onDelete: async () => {} });
  const { open, mode } = editor;
  const wasOpen = useRef(false);

  useEffect(() => open("return"), []); // eslint-disable-line react-hooks/exhaustive-deps -- opens once, on mount
  useEffect(() => {
    if (mode === "return") wasOpen.current = true;
    else if (wasOpen.current) onCancel();
  }, [mode, onCancel]);

  return mode === "return" ? <SavedItemEditor task={task} editor={editor} /> : null;
}
