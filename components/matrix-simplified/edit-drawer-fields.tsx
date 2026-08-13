"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { quadrants, QUADRANT_ACCENT, QUADRANT_HEADER, QUADRANT_INK } from "@/lib/quadrants";
import { DUE_PRESETS, type DuePreset } from "@/lib/due-date-presets";
import type { RecurrenceType, Subtask } from "@/lib/types";

// ─── Shared ────────────────────────────────────────────────────────────────

export function Field({
  label,
  children,
  as = "label",
}: {
  label: string;
  children: React.ReactNode;
  as?: "label" | "group";
}): React.ReactElement {
  if (as === "group") {
    return (
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
          {label}
        </legend>
        <div className="flex flex-col gap-1.5">{children}</div>
      </fieldset>
    );
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── QuadrantField ──────────────────────────────────────────────────────────

interface QuadrantFieldProps {
  urgent: boolean;
  important: boolean;
  onChange: (urgent: boolean, important: boolean) => void;
}

export function QuadrantField({ urgent, important, onChange }: QuadrantFieldProps): React.ReactElement {
  return (
    <Field label="Quadrant" as="group">
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map((q) => {
          const active = q.urgent === urgent && q.important === important;
          const a = QUADRANT_ACCENT[q.rdKey];
          const ink = QUADRANT_INK[q.rdKey];
          return (
            <button
              data-testid={`edit-quadrant-${q.rdKey}`}
              key={q.id}
              type="button"
              aria-label={q.title}
              onClick={() => onChange(q.urgent, q.important)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                active ? "border-2" : "border hover:bg-background-muted/30"
              )}
              style={
                active
                  ? { borderColor: a, backgroundColor: QUADRANT_HEADER[q.rdKey], color: ink }
                  : { borderColor: `color-mix(in srgb, ${a} 35%, transparent)`, color: ink }
              }
              aria-pressed={active}
            >
              <div className="text-[12px] font-bold uppercase tracking-wider">{q.title}</div>
              <div className="mt-0.5 text-[11.5px] opacity-80">{q.rdTag}</div>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

// ─── DueDateField ───────────────────────────────────────────────────────────

const chipDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function formatChipDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return chipDateFormatter.format(date);
}

interface DueDateFieldProps {
  duePreset: DuePreset;
  customDate: string | undefined;
  showCustomDateInput: boolean;
  onPresetChange: (preset: DuePreset) => void;
  onCustomDateChange: (date: string | undefined) => void;
  onToggleCustomInput: (show: boolean) => void;
}

export function DueDateField({
  duePreset, customDate, showCustomDateInput,
  onPresetChange, onCustomDateChange, onToggleCustomInput,
}: DueDateFieldProps): React.ReactElement {
  return (
    <Field label="Due date" as="group">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-background-muted p-1">
          {DUE_PRESETS.map((p) => {
            const isActive = !customDate && duePreset === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => { onPresetChange(p.value); onCustomDateChange(undefined); onToggleCustomInput(false); }}
                className={cn(
                  // Selected due-date preset reads in tide tint (reference §07);
                  // unselected presets stay graphite.
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-[background-color,color,box-shadow] duration-200",
                  isActive
                    ? "bg-accent-tint text-accent font-semibold shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                )}
                aria-pressed={isActive}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {customDate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground-muted/30 bg-background px-2.5 py-1 text-[12px] font-medium text-foreground">
            <CalendarIcon className="h-3 w-3" aria-hidden />
            {formatChipDate(customDate)}
            <button
              type="button"
              onClick={() => { onCustomDateChange(undefined); onToggleCustomInput(false); }}
              aria-label="Clear custom date"
              className="ml-0.5 text-foreground-muted hover:text-foreground"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ) : showCustomDateInput ? (
          <CustomDateInput
            onCustomDateChange={onCustomDateChange}
            onToggleCustomInput={onToggleCustomInput}
          />
        ) : (
          <button
            type="button"
            onClick={() => onToggleCustomInput(true)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-[12.5px] font-medium text-foreground-muted transition-colors hover:border-foreground-muted/50 hover:text-foreground"
          >
            <CalendarIcon className="h-3 w-3" aria-hidden />
            Pick a date…
          </button>
        )}
      </div>
    </Field>
  );
}

/**
 * Custom date picker input. Mounts only when the user clicks "Pick a date…",
 * so focusing it on mount (via ref + effect) is the intended UX. Using a ref
 * instead of the `autoFocus` prop keeps the focus behavior accessible.
 */
function CustomDateInput({
  onCustomDateChange,
  onToggleCustomInput,
}: {
  onCustomDateChange: (date: string | undefined) => void;
  onToggleCustomInput: (show: boolean) => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      onChange={(e) => { if (e.target.value) { onCustomDateChange(e.target.value); onToggleCustomInput(false); } }}
      onBlur={() => onToggleCustomInput(false)}
      className="rounded-md border border-border bg-background px-2.5 py-1 text-[12.5px] font-medium text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      aria-label="Pick a custom due date"
    />
  );
}

// ─── TagsField ──────────────────────────────────────────────────────────────

interface TagsFieldProps {
  tags: string[];
  tagInput: string;
  onTagInputChange: (v: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onTagKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function TagsField({ tags, tagInput, onTagInputChange, onAddTag, onRemoveTag, onTagKeyDown }: TagsFieldProps): React.ReactElement {
  return (
    <Field label="Tags" as="group">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
          >
            <span className="opacity-60">#</span>
            {t}
            {/* Removes a chip from an unsaved draft — nothing is persisted until
                Save, and re-adding is one keystroke. A confirmation dialog on a
                tag chip would be worse UX than the risk it guards. */}
            {/* ui-craft-detect-ignore-next-line */}
            <button
              type="button"
              onClick={() => onRemoveTag(t)}
              aria-label={`Remove ${t}`}
              className="rounded-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={onAddTag}
          placeholder={tags.length ? "" : "Add a tag…"}
          aria-label="Add a tag"
          // Inset ring: this input is borderless inside a bordered chip box, so
          // an offset ring would draw outside the field it belongs to.
          className="min-w-[80px] flex-1 rounded-xs border-0 bg-transparent text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        />
      </div>
    </Field>
  );
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * How often the task comes back.
 *
 * The recurrence engine has always worked — completing a recurring task spawns
 * the next instance — but nothing in the app could turn it on, so the About
 * page advertised a feature no user could reach.
 */
export function RecurrenceField({
  recurrence,
  onChange,
}: {
  recurrence: RecurrenceType;
  onChange: (value: RecurrenceType) => void;
}): React.ReactElement {
  return (
    <Field label="Repeat" as="group">
      <div className="flex flex-wrap gap-1.5">
        {RECURRENCE_OPTIONS.map((option) => {
          const active = option.value === recurrence;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={`edit-recurrence-${option.value}`}
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-foreground-muted hover:bg-background-muted"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

/**
 * A task's checklist.
 *
 * Progress already rendered on the card and in the detail sheet; only the way
 * to author the items was missing. Edits stay in the draft until Save, so
 * ticking an item here is reversible by closing without saving.
 */
export function SubtasksField({
  subtasks,
  onAdd,
  onToggle,
  onRemove,
}: {
  subtasks: Subtask[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}): React.ReactElement {
  const [entry, setEntry] = useState("");
  const done = subtasks.filter((s) => s.completed).length;

  const commit = (): void => {
    onAdd(entry);
    setEntry("");
  };

  return (
    <Field label={subtasks.length ? `Subtasks · ${done}/${subtasks.length}` : "Subtasks"} as="group">
      {subtasks.length > 0 ? (
        <ul className="space-y-1">
          {subtasks.map((subtask) => (
            <SubtaskRow
              key={subtask.id}
              subtask={subtask}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : null}
      <SubtaskEntry value={entry} onChange={setEntry} onCommit={commit} />
    </Field>
  );
}

/** One checklist item: tick, label, remove. */
function SubtaskRow({
  subtask,
  onToggle,
  onRemove,
}: {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}): React.ReactElement {
  return (
    <li className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={subtask.completed}
        onChange={() => onToggle(subtask.id)}
        aria-label={subtask.title}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-1"
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          subtask.completed ? "text-foreground-muted line-through" : "text-foreground"
        )}
      >
        {subtask.title}
      </span>
      {/* ui-craft-detect-ignore-next-line */}
      <button
        type="button"
        onClick={() => onRemove(subtask.id)}
        aria-label={`Remove subtask ${subtask.title}`}
        className="rounded-xs p-1 text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </li>
  );
}

/** The "add a subtask" input. Enter commits rather than submitting the drawer. */
function SubtaskEntry({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}): React.ReactElement {
  return (
    <input
      data-testid="edit-subtask-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        onCommit();
      }}
      placeholder="Add a subtask…"
      aria-label="Add a subtask"
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
    />
  );
}

/**
 * How long the task should take.
 *
 * The Review page has always reported Total Estimated and Estimation Accuracy;
 * with the timer wired to cards but no estimate input, both had nothing to
 * measure against.
 */
export function EstimateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <Field label="Estimate">
      <div className="flex items-center gap-2">
        <input
          data-testid="edit-estimate"
          type="number"
          min={1}
          max={10080}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          aria-label="Estimate in minutes"
          className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        />
        <span className="text-[13px] text-foreground-muted">minutes</span>
      </div>
    </Field>
  );
}
