"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon, FlameIcon, CalendarIcon, UsersIcon, Trash2Icon, type LucideIcon } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantMeta, RedesignQuadrantKey, RedesignIconKey } from "@/lib/quadrants";
import { QUADRANT_ACCENT, QUADRANT_INK } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

const RD_ICON: Record<RedesignIconKey, LucideIcon> = {
  flame: FlameIcon,
  calendar: CalendarIcon,
  users: UsersIcon,
  trash: Trash2Icon,
};

interface QuadrantPaneProps {
  meta: QuadrantMeta;
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void | Promise<void>;
  onDelete: (task: TaskRecord) => void | Promise<void>;
  onShare: (task: TaskRecord) => void;
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
  highlightedTaskId?: string | null;
  onTaskRef?: (taskId: string, element: HTMLElement | null) => void;
}

export function QuadrantPane({
  meta,
  tasks,
  allTasks,
  onEdit,
  onToggleComplete,
  onDelete,
  onShare,
  onAddInQuadrant,
  highlightedTaskId,
  onTaskRef,
}: QuadrantPaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const accent = QUADRANT_ACCENT[meta.rdKey];
  const ink = QUADRANT_INK[meta.rdKey];
  const QuadrantIcon = RD_ICON[meta.rdIcon];
  const taskIds = tasks.map((t) => t.id);
  const activeTaskCount = tasks.reduce((count, task) => count + (task.completed ? 0 : 1), 0);
  return (
    <section
      data-testid={`quadrant-${meta.rdKey}`}
      ref={setNodeRef}
      // Every pane shares one ground (bg-oat). Four differently-washed panes
      // read as four territories; one ground plus a pigment dot reads as one
      // matrix with four labelled regions — which is what the tool means.
      className={cn(
        "relative flex min-h-[280px] flex-col rounded-lg border border-gray-200 bg-oat transition-colors",
        isOver && "ring-2 ring-inset"
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        ...(isOver ? { ["--tw-ring-color" as string]: accent } : {}),
      }}
      aria-label={`${meta.title} quadrant`}
    >
      {/* Header sits on the pane ground with no tint and no bottom rule — the
          pane's own border is the only structure it needs at this size. */}
      <header className="flex items-center gap-2 px-[18px] pb-2.5 pt-3.5">
        {/* Quadrant identity is a 7px dot. It replaces the old 18px pigment
            glyph + 3px top bar: one small mark states the quadrant without
            competing with the task titles it sits above. */}
        <span
          data-testid="quadrant-icon"
          aria-hidden
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="shrink-0 text-[14px] font-semibold leading-none text-foreground">
          {meta.title}
        </span>
        <span className="min-w-0 truncate text-caption text-foreground-muted">{meta.rdHint}</span>
        <span className="ml-auto shrink-0 rounded-full bg-background-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-foreground-muted">
          {activeTaskCount}
        </span>
        <button
          type="button"
          onClick={() => onAddInQuadrant(meta.rdKey)}
          aria-label={`Add to ${meta.title}`}
          className="touch-target inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-icon text-foreground-muted hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-1">
          {tasks.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-2 py-4 text-center">
              {/* Reassuring mark: one icon in ink-3 on a 60pt sunken tile — never a
                  colorful illustration (reference §09). */}
              <span
                data-testid="quadrant-empty-mark"
                aria-hidden
                className="flex h-[60px] w-[60px] items-center justify-center rounded-lg bg-background-muted text-ink-3"
              >
                <QuadrantIcon className="h-6 w-6" />
              </span>
              <p className="text-balance text-[16px] font-semibold leading-tight tracking-tight text-foreground">
                {meta.rdEmptyHeadline}
              </p>
              <p className="max-w-[26ch] text-pretty text-caption text-foreground-muted">
                {meta.rdEmptySupporting}
              </p>
              {/* Eliminate is the one quadrant where an empty state needs no action
                  — there is nothing useful to add (reference §09). */}
              {meta.rdKey !== "q4" ? (
                <button
                  type="button"
                  onClick={() => onAddInQuadrant(meta.rdKey)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-background-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  // Border takes the raw pigment, text takes the darkened ink:
                  // brass (--q3) as 11px text measures 3.6:1 on the pane ground,
                  // under the 4.5:1 floor. A border has no such requirement.
                  style={{ borderColor: accent, color: ink }}
                >
                  <PlusIcon className="h-3 w-3" aria-hidden />
                  Add to {meta.title}
                </button>
              ) : null}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allTasks={allTasks}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
                onToggleComplete={onToggleComplete}
                isHighlighted={task.id === highlightedTaskId}
                taskRef={(element) => onTaskRef?.(task.id, element)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}
