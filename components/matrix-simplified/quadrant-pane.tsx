"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";
import type { QuadrantMeta, RedesignQuadrantKey } from "@/lib/quadrants";
import { QUADRANT_ACCENT } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

const WASH_CLASS: Record<RedesignQuadrantKey, string> = {
  q1: "quadrant-wash-q1",
  q2: "quadrant-wash-q2",
  q3: "quadrant-wash-q3",
  q4: "quadrant-wash-q4",
};

const HEADER_CLASS: Record<RedesignQuadrantKey, string> = {
  q1: "quadrant-header-q1",
  q2: "quadrant-header-q2",
  q3: "quadrant-header-q3",
  q4: "quadrant-header-q4",
};

export type QuadrantPosition = "tl" | "tr" | "bl" | "br";

// On md+, the outer container in <MatrixGrid> owns the perimeter border + radius.
// Each pane only contributes the rules between cells: a left rule for right-column
// panes and a top rule for bottom-row panes.
const POSITION_RULES: Record<QuadrantPosition, string> = {
  tl: "",
  tr: "md:border-l md:border-border",
  bl: "md:border-t md:border-border",
  br: "md:border-l md:border-t md:border-border",
};

interface QuadrantPaneProps {
  meta: QuadrantMeta;
  position: QuadrantPosition;
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
  position,
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
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const activeTaskCount = useMemo(
    () => tasks.reduce((count, task) => count + (task.completed ? 0 : 1), 0),
    [tasks]
  );
  return (
    <section
      data-testid={`quadrant-${meta.rdKey}`}
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[280px] flex-col rounded-xl border border-border p-5 transition-colors",
        WASH_CLASS[meta.rdKey],
        "md:rounded-none md:border-0",
        POSITION_RULES[position],
        isOver && "ring-2 ring-inset"
      )}
      style={isOver ? { ["--tw-ring-color" as string]: accent } : undefined}
      aria-label={`${meta.title} quadrant`}
    >
      {/* Quadrant identity: a 3px top accent bar in the quadrant hue, so the
          four-quadrant argument reads on the merged desktop grid. Thickens via
          scaleY (no reflow) to acknowledge an active drop target. Top corners
          `inherit` the pane radius so the bar follows the rounded corners on
          mobile (20px) and stays square on the md:rounded-none grid — no
          overflow-hidden, which would clip card action menus near pane edges. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[3px] origin-top transition-transform duration-150"
        style={{
          backgroundColor: accent,
          transform: isOver ? "scaleY(2)" : "scaleY(1)",
          borderTopLeftRadius: "inherit",
          borderTopRightRadius: "inherit",
        }}
      />
      <header
        className={cn(
          "-mx-5 -mt-5 mb-4 flex items-baseline gap-1 border-b border-border-muted px-5 py-3",
          HEADER_CLASS[meta.rdKey]
        )}
      >
        <span
          className="rd-serif text-[15px] font-semibold leading-none"
          style={{ color: accent, letterSpacing: "-0.005em" }}
        >
          {meta.title}
        </span>
        <span className="ml-1 text-caption text-foreground-muted">{meta.rdHint}</span>
        <span className="ml-auto rounded bg-background-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground-muted">
          {activeTaskCount}
        </span>
        <button
          type="button"
          onClick={() => onAddInQuadrant(meta.rdKey)}
          aria-label={`Add to ${meta.title}`}
          className="touch-target inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted hover:text-foreground"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-1.5 py-4 text-center">
              <p
                className="rd-serif text-[18px] leading-tight text-foreground"
                style={{ letterSpacing: "-0.01em" }}
              >
                {meta.rdEmptyHeadline}
              </p>
              <p className="max-w-[26ch] text-caption text-foreground-muted">
                {meta.rdEmptySupporting}
              </p>
              <button
                type="button"
                onClick={() => onAddInQuadrant(meta.rdKey)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-background-muted/40"
                style={{ borderColor: accent, color: accent }}
              >
                <PlusIcon className="h-3 w-3" aria-hidden />
                Add to {meta.title}
              </button>
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
