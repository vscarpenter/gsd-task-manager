"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlusIcon, FlameIcon, CalendarIcon, UsersIcon, TrashIcon, type LucideIcon } from "lucide-react";
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

const EMPTY_ICON: Record<RedesignQuadrantKey, LucideIcon> = {
  q1: FlameIcon,
  q2: CalendarIcon,
  q3: UsersIcon,
  q4: TrashIcon,
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
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
}

export function QuadrantPane({
  meta,
  position,
  tasks,
  allTasks,
  onEdit,
  onToggleComplete,
  onDelete,
  onAddInQuadrant,
}: QuadrantPaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.id });
  const accent = QUADRANT_ACCENT[meta.rdKey];
  const taskIds = tasks.map((t) => t.id);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[280px] flex-col rounded-2xl border border-border p-5 transition-colors",
        WASH_CLASS[meta.rdKey],
        "md:rounded-none md:border-0",
        POSITION_RULES[position],
        isOver && "ring-2 ring-inset"
      )}
      style={isOver ? { ["--tw-ring-color" as string]: accent } : undefined}
      aria-label={`${meta.title} quadrant`}
    >
      <header
        className={cn(
          "-mx-5 -mt-5 mb-4 flex items-center gap-2.5 border-b border-border-muted px-5 py-3",
          HEADER_CLASS[meta.rdKey]
        )}
      >
        <span
          className="rd-serif text-[15px] font-semibold leading-none"
          style={{ color: accent, letterSpacing: "-0.005em" }}
        >
          {meta.title}
        </span>
        <span className="text-[12.5px] text-foreground-muted">{meta.rdHint}</span>
        <span className="ml-auto rounded bg-background-muted px-1.5 text-[11px] font-medium tabular-nums text-foreground-muted">
          {tasks.filter((t) => !t.completed).length}
        </span>
        <button
          type="button"
          onClick={() => onAddInQuadrant(meta.rdKey)}
          aria-label={`Add to ${meta.title}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted hover:text-foreground"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-2 py-4">
              {(() => { const Icon = EMPTY_ICON[meta.rdKey]; return <Icon className="h-5 w-5 text-foreground-muted/30" aria-hidden />; })()}
              <p className="rd-serif text-center text-sm text-foreground-muted">
                {meta.rdEmpty}
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allTasks={allTasks}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}
