"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { TaskRecord } from "@/lib/types";
import { resolveDuePreset, type DuePreset } from "@/lib/due-date-presets";
import { UI_TIMING } from "@/lib/constants/ui";
import type { EditDraft } from "./edit-drawer";

function classifyExistingDate(iso: string | undefined): DuePreset {
  if (!iso) return "none";
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateOnly = iso.slice(0, 10);
  if (dateOnly === todayIso) return "today";
  const target = new Date(`${dateOnly}T00:00:00`);
  const today = new Date(`${todayIso}T00:00:00`);
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff > 0 && diff <= 7) return "this-week";
  if (diff > 7 && diff <= 14) return "next-week";
  return "none";
}

function classifyExistingCustomDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  if (classifyExistingDate(iso) !== "none") return undefined;
  return iso.slice(0, 10);
}

export interface EditDraftState {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  urgent: boolean;
  setUrgent: (v: boolean) => void;
  important: boolean;
  setImportant: (v: boolean) => void;
  duePreset: DuePreset;
  setDuePreset: (v: DuePreset) => void;
  customDate: string | undefined;
  setCustomDate: (v: string | undefined) => void;
  showCustomDateInput: boolean;
  setShowCustomDateInput: (v: boolean) => void;
  tags: string[];
  setTags: (v: string[]) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  addTag: () => void;
  toDraft: () => EditDraft;
}

/**
 * Owns all form-field state for EditDrawer. Field values are seeded once from
 * the task (edit mode) or initialDraft (create mode) via lazy useState
 * initializers. EditDrawer remounts this hook (via a `key` on the task id) when
 * the selected task changes, so no effect is needed to re-sync from props.
 */
export function useEditDraftState(
  task: TaskRecord | null | undefined,
  initialDraft: Partial<EditDraft> | undefined,
  titleRef: RefObject<HTMLInputElement | null>
): EditDraftState {
  const [title, setTitle] = useState(() => (task ? task.title : initialDraft?.title ?? ""));
  const [description, setDescription] = useState(() =>
    task ? task.description ?? "" : initialDraft?.description ?? ""
  );
  const [urgent, setUrgent] = useState(() => (task ? task.urgent : initialDraft?.urgent ?? false));
  const [important, setImportant] = useState(() =>
    task ? task.important : initialDraft?.important ?? false
  );
  const [duePreset, setDuePreset] = useState<DuePreset>(() =>
    task ? classifyExistingDate(task.dueDate) : "none"
  );
  const [customDate, setCustomDate] = useState<string | undefined>(() =>
    task ? classifyExistingCustomDate(task.dueDate) : undefined
  );
  const [showCustomDateInput, setShowCustomDateInput] = useState(false);
  const [tags, setTags] = useState<string[]>(() => (task ? task.tags ?? [] : initialDraft?.tags ?? []));
  const [tagInput, setTagInput] = useState("");

  // Move focus to the title field shortly after the drawer mounts.
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), UI_TIMING.FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [titleRef]);

  const addTag = (): void => {
    const v = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!v || tags.includes(v)) {
      setTagInput("");
      return;
    }
    setTags([...tags, v]);
    setTagInput("");
  };

  const toDraft = (): EditDraft => {
    const rawDate = customDate ?? resolveDuePreset(duePreset);
    const dueDate = rawDate ? new Date(`${rawDate}T00:00:00`).toISOString() : undefined;
    return {
      title: title.trim(),
      description: description.trim(),
      urgent,
      important,
      dueDate,
      tags,
    };
  };

  return {
    title, setTitle,
    description, setDescription,
    urgent, setUrgent,
    important, setImportant,
    duePreset, setDuePreset,
    customDate, setCustomDate,
    showCustomDateInput, setShowCustomDateInput,
    tags, setTags,
    tagInput, setTagInput,
    addTag,
    toDraft,
  };
}
