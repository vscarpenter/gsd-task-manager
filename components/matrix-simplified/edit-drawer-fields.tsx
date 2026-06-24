"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { quadrants, QUADRANT_ACCENT } from "@/lib/quadrants";
import { DUE_PRESETS, type DuePreset } from "@/lib/due-date-presets";

// ─── Shared ────────────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
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
    <Field label="Quadrant">
      <div className="grid grid-cols-2 gap-2">
        {quadrants.map((q) => {
          const active = q.urgent === urgent && q.important === important;
          const a = QUADRANT_ACCENT[q.rdKey];
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
                  ? { borderColor: a, backgroundColor: `color-mix(in srgb, ${a} 14%, transparent)`, color: a }
                  : { borderColor: `color-mix(in srgb, ${a} 35%, transparent)`, color: `color-mix(in srgb, ${a} 78%, var(--ink-3))` }
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

function formatChipDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
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
    <Field label="Due date">
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
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200",
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
          <input
            type="date"
            autoFocus
            onChange={(e) => { if (e.target.value) { onCustomDateChange(e.target.value); onToggleCustomInput(false); } }}
            onBlur={() => onToggleCustomInput(false)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-[12.5px] font-medium text-foreground outline-none focus:border-foreground-muted"
            aria-label="Pick a custom due date"
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
    <Field label="Tags">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
          >
            <span className="opacity-60">#</span>
            {t}
            <button
              type="button"
              onClick={() => onRemoveTag(t)}
              aria-label={`Remove ${t}`}
              className="hover:text-foreground"
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
          className="min-w-[80px] flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
        />
      </div>
    </Field>
  );
}
