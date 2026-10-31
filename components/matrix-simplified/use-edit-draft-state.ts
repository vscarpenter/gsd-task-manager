"use client";

import { useEffect, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { RecurrenceType, Subtask, TaskRecord } from "@/lib/types";
import { DUE_PRESETS, localDayOf, resolveDuePreset, type DuePreset } from "@/lib/due-date-presets";
import { combine, onDate, timeOf } from "@/lib/due-time";
import { useDefaultReminder } from "@/lib/notifications/use-default-reminder";
import { UI_TIMING } from "@/lib/constants/ui";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { hasVisibleText } from "@/lib/utils";
import { generateId } from "@/lib/id-generator";
import type { EditDraft } from "./edit-draft";

/**
 * The preset whose own date an existing due date falls on, or "none".
 *
 * Only an exact match counts. A range ("within 7 days" → This week) made save
 * re-resolve the preset and move an untouched date to Friday or Monday.
 */
function classifyExistingDate(iso: string | undefined): DuePreset {
  if (!iso) return "none";
  const day = localDayOf(iso);
  return DUE_PRESETS.find(({ value }) => resolveDuePreset(value) === day)?.value ?? "none";
}

function classifyExistingCustomDate(iso: string | undefined): string | undefined {
  if (!iso || classifyExistingDate(iso) !== "none") return undefined;
  return localDayOf(iso);
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
  /** Local "HH:mm", or undefined for an all-day due date. */
  dueTime: string | undefined;
  setDueTime: (v: string | undefined) => void;
  tags: string[];
  setTags: (v: string[]) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  addTag: () => void;
  dependencies: string[];
  setDependencies: (v: string[]) => void;
  recurrence: RecurrenceType;
  setRecurrence: (v: RecurrenceType) => void;
  subtasks: Subtask[];
  addSubtask: (title: string) => void;
  toggleSubtask: (id: string) => void;
  removeSubtask: (id: string) => void;
  estimateInput: string;
  setEstimateInput: (v: string) => void;
  /** Minutes before due, or null for "no reminder on this task". */
  reminderMinutes: number | null;
  setReminderMinutes: (v: number | null) => void;
  toDraft: () => EditDraft;
}

/** The three ways a draft's checklist changes. */
function subtaskActions(setSubtasks: Dispatch<SetStateAction<Subtask[]>>) {
  return {
    addSubtask: (title: string) => setSubtasks((current) => appendSubtask(current, title)),
    toggleSubtask: (id: string) =>
      setSubtasks((current) =>
        current.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
      ),
    removeSubtask: (id: string) => setSubtasks((current) => current.filter((s) => s.id !== id)),
  };
}

/**
 * Minutes, or undefined for "no estimate".
 *
 * An empty field must not become 0 — the Review page averages estimates, and a
 * zero would drag Estimation Accuracy down for every task nobody estimated.
 */
function parseEstimate(raw: string): number | undefined {
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Append a subtask, ignoring blank input. Ids are generated locally until save. */
function appendSubtask(subtasks: Subtask[], rawTitle: string): Subtask[] {
  const title = rawTitle.trim();
  if (!hasVisibleText(title) || subtasks.length >= SCHEMA_LIMITS.MAX_SUBTASKS) return subtasks;
  return [...subtasks, { id: generateId(), title, completed: false }];
}

/**
 * The fields that describe the work itself: how often it repeats, what it
 * breaks into, and how long it should take.
 *
 * Split from the core fields so the drawer's state hook stops growing every
 * time a field is added — the reason the shape ratchet caught the last three.
 */
function useDetailDraftFields(
  task: TaskRecord | null | undefined,
  initialDraft: Partial<EditDraft> | undefined
) {
  const [recurrence, setRecurrence] = useState<RecurrenceType>(() =>
    task ? task.recurrence ?? "none" : initialDraft?.recurrence ?? "none"
  );
  const [subtasks, setSubtasks] = useState<Subtask[]>(() =>
    task ? task.subtasks ?? [] : initialDraft?.subtasks ?? []
  );
  // Held as a string so an emptied field means "no estimate" rather than 0.
  const [estimateInput, setEstimateInput] = useState<string>(() =>
    String(task?.estimatedMinutes ?? initialDraft?.estimatedMinutes ?? "")
  );
  const reminder = useReminderDraft(task, initialDraft);

  return {
    recurrence,
    setRecurrence,
    subtasks,
    ...subtaskActions(setSubtasks),
    estimateInput,
    setEstimateInput,
    reminderMinutes: reminder.minutes,
    setReminderMinutes: reminder.setMinutes,
    reminderDraftFields: reminder.draftFields,
  };
}

/** A pick is minutes, null for Off, or undefined while the user hasn't touched the field. */
type ReminderPick = number | null | undefined;

/** What the Reminder field shows: the pick once made, else what the checker will fire. */
function displayedReminder(
  task: TaskRecord | null | undefined,
  pick: ReminderPick,
  defaultReminder: number
): number | null {
  if (pick !== undefined) return pick;
  if (!task?.notificationEnabled) return null;
  return task.notifyBefore ?? defaultReminder;
}

/** What a save writes: the stored pair while untouched, else the pick. */
function savedReminder(
  task: TaskRecord | null | undefined,
  pick: ReminderPick
): Pick<EditDraft, "notifyBefore" | "notificationEnabled"> {
  if (task && pick === undefined) {
    return { notifyBefore: task.notifyBefore, notificationEnabled: task.notificationEnabled };
  }
  return { notifyBefore: pick ?? undefined, notificationEnabled: typeof pick === "number" };
}

/**
 * The Reminder field. A task with reminders on but no offset of its own follows the
 * default from Settings, so it shows that default, and an untouched field saves the
 * stored values back unchanged. It used to read Off, and any save turned the reminder off.
 */
function useReminderDraft(
  task: TaskRecord | null | undefined,
  initialDraft: Partial<EditDraft> | undefined
) {
  const defaultReminder = useDefaultReminder();
  // Edit mode starts untouched. Create mode starts from the seeded draft, Off by default.
  const [pick, setPick] = useState<ReminderPick>(() => {
    if (task) return undefined;
    return initialDraft?.notificationEnabled ? initialDraft.notifyBefore ?? null : null;
  });

  return {
    minutes: displayedReminder(task, pick, defaultReminder),
    setMinutes: (value: number | null) => setPick(value),
    draftFields: () => savedReminder(task, pick),
  };
}

/**
 * The fields whose value differs between the drawer's starting draft and the
 * current one. A cleared field stays in the result as `undefined`.
 *
 * Saving only these keeps a drawer that sat open in a stale tab from writing
 * its old title, tags, or flags over a newer save from somewhere else.
 */
export function changedDraftFields(start: EditDraft, current: EditDraft): Partial<EditDraft> {
  const changed: Partial<EditDraft> = {};
  for (const key of Object.keys(current) as Array<keyof EditDraft>) {
    if (JSON.stringify(start[key]) !== JSON.stringify(current[key])) {
      Object.assign(changed, { [key]: current[key] });
    }
  }
  // The two flags name one quadrant. Sent alone, one would merge with the other
  // stored flag and put the task in a quadrant nobody picked.
  if ("urgent" in changed || "important" in changed) {
    changed.urgent = current.urgent;
    changed.important = current.important;
  }
  return changed;
}

/** Tags come from the task in edit mode and the seeded draft in create mode. */
function seedTags(
  task: TaskRecord | null | undefined,
  initialDraft: Partial<EditDraft> | undefined
): string[] {
  return task ? task.tags ?? [] : initialDraft?.tags ?? [];
}

/** Normalise and append a tag, ignoring blanks and duplicates. */
function appendTag(tags: string[], raw: string): string[] {
  const value = raw.trim().toLowerCase().replace(/^#/, "");
  if (!hasVisibleText(value) || tags.includes(value) || tags.length >= SCHEMA_LIMITS.MAX_TAGS) {
    return tags;
  }
  return [...tags, value];
}

/** Move focus to the title field shortly after the drawer mounts. */
function useAutofocusTitle(titleRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), UI_TIMING.FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [titleRef]);
}

/**
 * Resolve the picked preset (or custom date) into an ISO due date. A pick on the
 * stored date's own day returns the stored value, so a save never rewrites a due
 * date, or its time of day, that the user didn't change.
 */
function resolveDueDate(
  customDate: string | undefined,
  duePreset: DuePreset,
  dueTime: string | undefined,
  storedDueDate: string | undefined
): string | undefined {
  const rawDate = customDate ?? resolveDuePreset(duePreset);
  if (!rawDate) return undefined;
  if (storedDueDate && timeOf(storedDueDate) === dueTime) {
    // An untouched time keeps its seconds too, so a day change never rewrites it.
    return localDayOf(storedDueDate) === rawDate ? storedDueDate : onDate(storedDueDate, rawDate);
  }
  return combine(rawDate, dueTime);
}

/**
 * Owns all form-field state for EditDrawer. Field values are seeded once from
 * the task (edit mode) or initialDraft (create mode) via lazy useState
 * initializers. EditDrawer remounts this hook (via a `key` on the task id) when
 * the selected task changes, so no effect is needed to re-sync from props.
 */
/** The due-date trio: preset classification, custom date, and its input's visibility. */
function useDueDateDraft(task: TaskRecord | null | undefined) {
  const [duePreset, setDuePreset] = useState<DuePreset>(() =>
    task ? classifyExistingDate(task.dueDate) : "none"
  );
  const [customDate, setCustomDate] = useState<string | undefined>(() =>
    task ? classifyExistingCustomDate(task.dueDate) : undefined
  );
  const [showCustomDateInput, setShowCustomDateInput] = useState(false);
  const [dueTime, setDueTime] = useState<string | undefined>(() =>
    task?.dueDate ? timeOf(task.dueDate) : undefined
  );
  // A preset writes an all-day date, as Android does (`preset.resolve(today).atStartOfDay`).
  // Only picking a date keeps the time already set.
  const changePreset = (preset: DuePreset): void => {
    setDuePreset(preset);
    setDueTime(undefined);
  };
  return {
    duePreset, setDuePreset: changePreset, customDate, setCustomDate,
    showCustomDateInput, setShowCustomDateInput, dueTime, setDueTime,
  };
}

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
  const due = useDueDateDraft(task);
  const [tags, setTags] = useState<string[]>(() => seedTags(task, initialDraft));
  const [tagInput, setTagInput] = useState("");
  const [dependencies, setDependencies] = useState<string[]>(() =>
    task ? task.dependencies ?? [] : initialDraft?.dependencies ?? []
  );
  const { reminderDraftFields, ...detail } = useDetailDraftFields(task, initialDraft);

  useAutofocusTitle(titleRef);

  const addTag = (): void => {
    setTags(appendTag(tags, tagInput));
    setTagInput("");
  };

  const toDraft = (): EditDraft => ({
    title: title.trim(),
    description: description.trim(),
    urgent,
    important,
    dueDate: resolveDueDate(due.customDate, due.duePreset, due.dueTime, task?.dueDate),
    tags,
    dependencies,
    recurrence: detail.recurrence,
    subtasks: detail.subtasks,
    estimatedMinutes: parseEstimate(detail.estimateInput),
    ...reminderDraftFields(),
  });

  return {
    title, setTitle,
    description, setDescription,
    urgent, setUrgent,
    important, setImportant,
    ...due,
    tags, setTags,
    tagInput, setTagInput,
    addTag,
    dependencies, setDependencies,
    ...detail,
    toDraft,
  };
}
