"use client";

import { useRef, useState, type FormEvent } from "react";
import type { TaskRecord } from "@/lib/types";
import { hasVisibleText } from "@/lib/utils";
import { findDependencyCycleError } from "./edit-drawer-dependencies";
import type { EditDraft } from "./edit-draft";
import { changedDraftFields, type EditDraftState } from "./use-edit-draft-state";

type EditDrawerSubmit = (
  draft: EditDraft,
  taskId?: string,
  changed?: Partial<EditDraft>
) => void | Promise<void>;

interface DrawerSaveArgs {
  task?: TaskRecord | null;
  draft: EditDraftState;
  baseline: EditDraft | null;
  allTasks: TaskRecord[];
  onSubmit: EditDrawerSubmit;
  setDependencyError: (message: string | null) => void;
}

/**
 * Save flow: block a blank title or a dependency loop, ignore repeat submits
 * while one is in flight, and in edit mode hand over only the changed fields.
 */
export function useDrawerSave({ task, draft, baseline, allTasks, onSubmit, setDependencyError }: DrawerSaveArgs) {
  // The drawer stays open until the save resolves, so a double-click or quick
  // Enters used to create the same task several times.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault();
    if (!hasVisibleText(draft.title) || savingRef.current) return;
    const cycleError = task
      ? findDependencyCycleError(task.id, draft.dependencies, allTasks)
      : null;
    if (cycleError) {
      setDependencyError(cycleError);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const current = draft.toDraft();
      if (task) await onSubmit(current, task.id, changedDraftFields(baseline ?? current, current));
      else await onSubmit(current, undefined);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return { saving, submit };
}
