"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { wouldCreateCircularDependency } from "@/lib/dependencies";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { Field } from "./edit-drawer-fields";

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

  // Ghost IDs (no local record) render no chip but stay in `dependencies`.
  const chips = dependencies
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is TaskRecord => t !== undefined);
  const atLimit = dependencies.length >= SCHEMA_LIMITS.MAX_DEPENDENCIES;

  return (
    <Field label="Depends on">
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
          {chips.map((t) => (
            <span
              key={t.id}
              data-testid="dep-chip"
              className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
            >
              {t.title}
              <button
                type="button"
                onClick={() => onChange(dependencies.filter((id) => id !== t.id))}
                aria-label={`Remove dependency ${t.title}`}
                className="hover:text-foreground"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={query}
            disabled={atLimit}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={chips.length ? "" : "Search tasks this one depends on…"}
            aria-label="Search tasks to add as a dependency"
            className="min-w-[80px] flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none disabled:cursor-not-allowed"
          />
        </div>
        <Suggestions
          open={open}
          query={query}
          taskId={taskId}
          dependencies={dependencies}
          allTasks={allTasks}
          onPick={(id) => {
            onChange([...dependencies, id]);
            setQuery("");
            setOpen(false);
          }}
        />
      </div>
      {atLimit ? (
        <p className="text-[11.5px] text-foreground-muted">
          Dependency limit reached ({SCHEMA_LIMITS.MAX_DEPENDENCIES}).
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </Field>
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

function Suggestions({
  open,
  query,
  taskId,
  dependencies,
  allTasks,
  onPick,
}: {
  open: boolean;
  query: string;
  taskId?: string;
  dependencies: string[];
  allTasks: TaskRecord[];
  onPick: (id: string) => void;
}): React.ReactElement | null {
  const trimmed = query.trim().toLowerCase();
  if (!open || !trimmed) return null;

  const matches = allTasks
    .filter((t) => isCandidate(t, taskId, dependencies, allTasks))
    .filter((t) => t.title.toLowerCase().includes(trimmed))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      {matches.length > 0 ? (
        matches.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid="dep-suggestion"
            onClick={() => onPick(t.id)}
            className="block w-full truncate px-3 py-2 text-left text-[13px] text-foreground hover:bg-background-muted"
          >
            {t.title}
          </button>
        ))
      ) : (
        <p className="px-3 py-2 text-[12.5px] text-foreground-muted">No matching tasks.</p>
      )}
    </div>
  );
}
