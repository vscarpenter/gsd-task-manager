"use client";

import { quadrants, type RedesignQuadrantKey } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { QuadrantPane } from "./quadrant-pane";

interface MatrixGridProps {
  tasks: TaskRecord[];
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onInspect?: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void | Promise<void>;
  onDelete: (task: TaskRecord) => void | Promise<void>;
  onShare: (task: TaskRecord) => void;
  onAddInQuadrant: (key: RedesignQuadrantKey) => void;
  highlightedTaskId?: string | null;
  onTaskRef?: (taskId: string, element: HTMLElement | null) => void;
  onQuadrantRef?: (key: RedesignQuadrantKey, element: HTMLElement | null) => void;
}

export function MatrixGrid({
  tasks,
  allTasks,
  onEdit,
  onInspect,
  onToggleComplete,
  onDelete,
  onShare,
  onAddInQuadrant,
  highlightedTaskId,
  onTaskRef,
  onQuadrantRef,
}: MatrixGridProps) {
  const grouped = (() => {
    const out: Record<RedesignQuadrantKey, TaskRecord[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const t of tasks) {
      if (t.urgent && t.important) out.q1.push(t);
      else if (!t.urgent && t.important) out.q2.push(t);
      else if (t.urgent && !t.important) out.q3.push(t);
      else out.q4.push(t);
    }
    for (const key of Object.keys(out) as RedesignQuadrantKey[]) {
      out[key].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
    }
    return out;
  })();

  return (
    // Four floating panes on a constant 16px gutter. The old lg: rules merged
    // them into one bordered container and zeroed the gap, which made the
    // matrix read as a single table; the gutter is what lets each quadrant read
    // as its own surface while the 2x2 arrangement still carries the argument.
    //
    // Columns are decided by the grid's own available width, not by a viewport
    // breakpoint. A breakpoint cannot see the icon rail: at 768px the expanded
    // rail takes ~180px, so a md:grid-cols-2 rule produced 245px panes in which
    // every task title truncated to about fifteen characters.
    //
    // The count is capped at two on purpose. auto-fit would have found three
    // columns on a wide desktop, and a 3+1 arrangement destroys the argument
    // exactly as thoroughly as a 1x4 stack: the matrix means Q1/Q2 over Q3/Q4
    // or it means nothing. 696px is two 340px panes plus the 16px gutter.
    <div className="@container">
      <div
        data-testid="matrix-grid"
        className="grid gap-4 @min-[696px]:grid-cols-2 @min-[696px]:grid-rows-2"
      >
        {quadrants.map((meta) => (
          <QuadrantPane
            key={meta.id}
            meta={meta}
            tasks={grouped[meta.rdKey]}
            allTasks={allTasks}
            onEdit={onEdit}
            onInspect={onInspect}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            onShare={onShare}
            onAddInQuadrant={onAddInQuadrant}
            highlightedTaskId={highlightedTaskId}
            onTaskRef={onTaskRef}
            sectionRef={(element) => onQuadrantRef?.(meta.rdKey, element)}
          />
        ))}
      </div>
    </div>
  );
}
