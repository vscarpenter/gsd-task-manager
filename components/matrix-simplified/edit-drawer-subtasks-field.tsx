"use client";

import { XIcon } from "lucide-react";
import { isImeComposing } from "@/lib/ime";
import { cn } from "@/lib/utils";
import type { Subtask } from "@/lib/types";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { Field, LimitNote } from "./edit-drawer-fields";
import { LengthLimitNote } from "./limit-note";

/**
 * A task's checklist.
 *
 * Progress already rendered on the card and in the detail sheet; only the way
 * to author the items was missing. Edits stay in the draft until Save, so
 * ticking an item here is reversible by closing without saving.
 */
interface SubtasksFieldProps {
  subtasks: Subtask[];
  entry: string;
  onEntryChange: (value: string) => void;
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function SubtasksField({ subtasks, entry, onEntryChange, onAdd, onToggle, onRemove }: Readonly<SubtasksFieldProps>): React.ReactElement {
  const done = subtasks.filter((s) => s.completed).length;
  const atLimit = subtasks.length >= SCHEMA_LIMITS.MAX_SUBTASKS;

  const commit = (): void => {
    onAdd(entry);
    onEntryChange("");
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
      <SubtaskEntry value={entry} onChange={onEntryChange} onCommit={commit} disabled={atLimit} />
      {atLimit ? <LimitNote>A task can have up to {SCHEMA_LIMITS.MAX_SUBTASKS} subtasks.</LimitNote> : null}
      <LengthLimitNote field="subtasks" length={entry.length} max={SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH} />
    </Field>
  );
}

/** One checklist item: tick, label, remove. */
interface SubtaskRowProps {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function SubtaskRow({ subtask, onToggle, onRemove }: Readonly<SubtaskRowProps>): React.ReactElement {
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
          "min-w-0 flex-1 truncate text-small",
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
  disabled,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  disabled: boolean;
}>): React.ReactElement {
  return (
    <input
      data-testid="edit-subtask-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        // Swallowed either way, or Enter submits the drawer's form. An IME's
        // Enter confirms a conversion, so only a plain one adds the subtask.
        e.preventDefault();
        if (!isImeComposing(e.nativeEvent)) onCommit();
      }}
      placeholder="Add a subtask…"
      aria-label="Add a subtask"
      maxLength={SCHEMA_LIMITS.SUBTASK_TITLE_MAX_LENGTH}
      disabled={disabled}
      className="pointer-coarse:text-base w-full rounded-lg border border-border bg-background px-3 py-2 text-small text-foreground outline-none focus:border-foreground-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
    />
  );
}
