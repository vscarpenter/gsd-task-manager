"use client";

import { quadrants, type RedesignQuadrantKey } from "@/lib/quadrants";
import type { TaskRecord } from "@/lib/types";
import { QuadrantPane } from "./quadrant-pane";

interface MatrixGridProps {
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

export function MatrixGrid({
  tasks,
  allTasks,
  onEdit,
  onToggleComplete,
  onDelete,
  onShare,
  onAddInQuadrant,
  highlightedTaskId,
  onTaskRef,
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
    <div data-testid="matrix-grid" className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:grid-rows-2 lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
      {quadrants.map((meta, index) => (
        <QuadrantPane
          key={meta.id}
          meta={meta}
          position={POSITIONS[index]}
          tasks={grouped[meta.rdKey]}
          allTasks={allTasks}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
          onShare={onShare}
          onAddInQuadrant={onAddInQuadrant}
          highlightedTaskId={highlightedTaskId}
          onTaskRef={onTaskRef}
        />
      ))}
    </div>
  );
}

const POSITIONS = ["tl", "tr", "bl", "br"] as const;
