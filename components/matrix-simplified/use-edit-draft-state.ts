"use client";

import { useEffect, useRef, useState } from "react";
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
 * Owns all form-field state for EditDrawer and rehydrates when the drawer
 * opens or the selected task changes.
 */
export function useEditDraftState(
  open: boolean,
  task: TaskRecord | null | undefined,
  initialDraft: Partial<EditDraft> | undefined,
  titleRef: RefObject<HTMLInputElement | null>
): EditDraftState {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [duePreset, setDuePreset] = useState<DuePreset>("none");
  const [customDate, setCustomDate] = useState<string | undefined>(undefined);
  const [showCustomDateInput, setShowCustomDateInput] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Rehydrate all draft fields whenever the drawer opens or the selected task changes.
  // Calling multiple setters inside a useEffect is intentional here — each setter maps
  // directly to one form field, and batching them into a reducer would add indirection
  // without improving clarity. React 18 batches these updates automatically.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setUrgent(task.urgent);
      setImportant(task.important);
      setDuePreset(classifyExistingDate(task.dueDate));
      setCustomDate(classifyExistingCustomDate(task.dueDate));
      setTags(task.tags ?? []);
    } else {
      setTitle(initialDraft?.title ?? "");
      setDescription(initialDraft?.description ?? "");
      setUrgent(initialDraft?.urgent ?? false);
      setImportant(initialDraft?.important ?? false);
      setDuePreset("none");
      setCustomDate(undefined);
      setTags(initialDraft?.tags ?? []);
    }
    setShowCustomDateInput(false);
    setTagInput("");
    setTimeout(() => titleRef.current?.focus(), UI_TIMING.FOCUS_DELAY_MS);
  }, [open, task, initialDraft, titleRef]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
