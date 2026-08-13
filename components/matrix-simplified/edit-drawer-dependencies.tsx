"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { wouldCreateCircularDependency } from "@/lib/dependencies";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { Field } from "./edit-drawer-fields";
import { useSuggestionCombobox } from "./use-suggestion-combobox";

const MAX_SUGGESTIONS = 8;

/**
 * Save-time cycle guard for the edit drawer. Unlike lib's validateDependencies,
 * IDs that don't resolve locally are skipped rather than rejected — they may
 * reference tasks that haven't synced to this device yet and must be preserved.
 */
export function findDependencyCycleError(
  taskId: string,
  dependencies: string[],
  allTasks: TaskRecord[]
): string | null {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  for (const depId of dependencies) {
    const dep = byId.get(depId);
    if (!dep) continue;
    if (wouldCreateCircularDependency(taskId, depId, allTasks)) {
      return `Circular dependency: "${dep.title}" already depends on this task.`;
    }
  }
  return null;
}

interface DependenciesFieldProps {
  /** Undefined in create mode — cycle filtering is skipped (nothing can depend on an unsaved task). */
  taskId?: string;
  dependencies: string[];
  allTasks: TaskRecord[];
  onChange: (ids: string[]) => void;
  error?: string | null;
}

export function DependenciesField({
  taskId,
  dependencies,
  allTasks,
  onChange,
  error,
}: DependenciesFieldProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const limitNoteId = useId();
  const errorId = useId();
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const matches = matchingCandidates(query, taskId, dependencies, allTasks);

  const pick = (id: string) => {
    onChange([...dependencies, id]);
    setQuery("");
    setOpen(false);
    combobox.resetActive();
    // Picking removes the focused suggestion button from the DOM;
    // return focus to the input so keyboard users keep their place.
    inputRef.current?.focus();
  };

  const combobox = useSuggestionCombobox(open && query.trim().length > 0, {
    count: matches.length,
    onPick: (index) => {
      const picked = matches[index];
      if (picked) pick(picked.id);
    },
    onDismiss: () => setOpen(false),
  });
  const { activeIndex, anchorRect, anchorRef } = combobox;

  // Ghost IDs (no local record) render no chip but stay in `dependencies`.
  const chips = dependencies
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is TaskRecord => t !== undefined);
  const atLimit = dependencies.length >= SCHEMA_LIMITS.MAX_DEPENDENCIES;
  const suggestionsVisible = open && query.trim().length > 0;
  const describedBy =
    [atLimit ? limitNoteId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <Field label="Depends on" as="group">
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <div
          ref={anchorRef}
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2"
        >
          <DependencyChips
            chips={chips}
            onRemove={(id) => onChange(dependencies.filter((depId) => depId !== id))}
          />
          <input
            data-testid="dep-search"
            ref={inputRef}
            value={query}
            disabled={atLimit}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              combobox.resetActive();
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={combobox.onKeyDown}
            placeholder={chips.length ? "" : "Search tasks this one depends on…"}
            aria-label="Search tasks to add as a dependency"
            role="combobox"
            aria-expanded={suggestionsVisible}
            aria-controls={suggestionsVisible ? listboxId : undefined}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="min-w-[80px] flex-1 rounded-xs border-0 bg-transparent text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-not-allowed"
          />
        </div>
        <Suggestions
          open={open}
          query={query}
          taskId={taskId}
          dependencies={dependencies}
          allTasks={allTasks}
          anchorRect={anchorRect}
          activeIndex={activeIndex}
          listboxId={listboxId}
          optionId={optionId}
          onPick={pick}
        />
      </div>
      <FieldNotes atLimit={atLimit} limitNoteId={limitNoteId} error={error} errorId={errorId} />
    </Field>
  );
}

/** The limit caption and validation error that sit under the field. */
function FieldNotes({
  atLimit,
  limitNoteId,
  error,
  errorId,
}: {
  atLimit: boolean;
  limitNoteId: string;
  error?: string | null;
  errorId: string;
}): React.ReactElement {
  return (
    <>
      {atLimit ? (
        <p id={limitNoteId} className="text-[11.5px] text-foreground-muted">
          Dependency limit reached ({SCHEMA_LIMITS.MAX_DEPENDENCIES}).
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-rust-d">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Selected dependencies, each removable while the draft is unsaved. */
function DependencyChips({
  chips,
  onRemove,
}: {
  chips: TaskRecord[];
  onRemove: (id: string) => void;
}): React.ReactElement {
  return (
    <>
      {chips.map((t) => (
        <span
          key={t.id}
          data-testid="dep-chip"
          className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
        >
          {t.title}
          {/* Unsaved-draft chip removal, same as the tag chips: reversible by
              re-searching, and nothing is written until Save. */}
          {/* ui-craft-detect-ignore-next-line */}
          <button
            type="button"
            onClick={() => onRemove(t.id)}
            aria-label={`Remove dependency ${t.title}`}
            className="rounded-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
    </>
  );
}

function isCandidate(
  candidate: TaskRecord,
  taskId: string | undefined,
  dependencies: string[],
  allTasks: TaskRecord[]
): boolean {
  if (candidate.id === taskId) return false;
  if (dependencies.includes(candidate.id)) return false;
  if (candidate.completed) return false;
  if (taskId && wouldCreateCircularDependency(taskId, candidate.id, allTasks)) return false;
  return true;
}

/** The suggestion list, shared by the popup and the keyboard handler. */
function matchingCandidates(
  query: string,
  taskId: string | undefined,
  dependencies: string[],
  allTasks: TaskRecord[]
): TaskRecord[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return allTasks
    .filter((t) => isCandidate(t, taskId, dependencies, allTasks))
    .filter((t) => t.title.toLowerCase().includes(trimmed))
    .slice(0, MAX_SUGGESTIONS);
}

/** Vertical gap between the field and its popup, in px. */
const POPUP_OFFSET = 4;
/** Rough popup height used to decide whether to flip above the field. */
const POPUP_MAX_HEIGHT = 280;

/**
 * Position the popup against the viewport, flipping above the anchor when the
 * space below cannot hold it.
 *
 * `fixed` rather than `absolute` because the popup is portalled out of the
 * drawer: it has no positioned ancestor to measure against any more, and the
 * viewport is exactly the frame collision should be judged in.
 */
function popupStyle(anchor: DOMRect | null): React.CSSProperties {
  if (!anchor) return { display: "none" };

  const spaceBelow = window.innerHeight - anchor.bottom;
  const flipUp = spaceBelow < POPUP_MAX_HEIGHT && anchor.top > spaceBelow;

  return {
    position: "fixed",
    left: anchor.left,
    width: anchor.width,
    maxHeight: POPUP_MAX_HEIGHT,
    ...(flipUp
      ? { bottom: window.innerHeight - anchor.top + POPUP_OFFSET }
      : { top: anchor.bottom + POPUP_OFFSET }),
  };
}

function Suggestions({
  open,
  query,
  taskId,
  dependencies,
  allTasks,
  anchorRect,
  activeIndex,
  listboxId,
  optionId,
  onPick,
}: {
  open: boolean;
  query: string;
  taskId?: string;
  dependencies: string[];
  allTasks: TaskRecord[];
  anchorRect: DOMRect | null;
  activeIndex: number;
  listboxId: string;
  optionId: (index: number) => string;
  onPick: (id: string) => void;
}): React.ReactElement | null {
  const trimmed = query.trim().toLowerCase();
  if (!open || !trimmed) return null;

  const matches = matchingCandidates(query, taskId, dependencies, allTasks);

  // Portalled to the body because the drawer's scrolling container
  // (`overflow-auto`) clips absolutely-positioned descendants. The list was cut
  // off behind the sticky Save footer and unclickable at 1280x720 — clipping
  // that no z-index can undo, because the pixels are never painted.
  return createPortal(
    <div
      id={listboxId}
      role="listbox"
      aria-label="Matching tasks"
      style={popupStyle(anchorRect)}
      className="z-[70] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      {matches.length > 0 ? (
        matches.map((t, index) => (
          <button
            key={t.id}
            type="button"
            role="option"
            id={optionId(index)}
            aria-selected={index === activeIndex}
            data-testid="dep-suggestion"
            // Keep the search input focused through pointer activation. WebKit
            // can report a null blur relatedTarget before click otherwise,
            // unmounting the option before it can commit the selection.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onPick(t.id)}
            className={`block w-full truncate px-3 py-2 text-left text-[13px] text-foreground hover:bg-background-muted ${
              index === activeIndex ? "bg-background-muted" : ""
            }`}
          >
            {t.title}
          </button>
        ))
      ) : (
        <p className="px-3 py-2 text-[12.5px] text-foreground-muted">No matching tasks.</p>
      )}
    </div>,
    document.body
  );
}
