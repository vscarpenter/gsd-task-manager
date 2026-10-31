"use client";

import { useState } from "react";
import type { TaskRecord } from "@/lib/types";
import type { EditDraft } from "./edit-draft";

/**
 * The snooze the drawer is editing, applied on Save like iOS and Android. A
 * snooze that has already lapsed counts as none, and the field only exists for
 * an open task being edited.
 */
export function useSnoozeDraft(task: TaskRecord | null | undefined) {
  const [snoozedUntil, setSnoozedUntil] = useState<string | undefined>(() =>
    task?.snoozedUntil && new Date(task.snoozedUntil) > new Date() ? task.snoozedUntil : undefined
  );
  return {
    snoozedUntil,
    setSnoozedUntil,
    canSnooze: Boolean(task && !task.completed),
    // Left out when unset so a new task's draft carries no stray key.
    draftFields: (): Pick<EditDraft, "snoozedUntil"> | Record<string, never> =>
      snoozedUntil ? { snoozedUntil } : {},
  };
}
