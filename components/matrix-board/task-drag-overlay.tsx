"use client";

import { DragOverlay } from "@dnd-kit/core";
import type { TaskRecord } from "@/lib/types";

interface TaskDragOverlayProps {
  activeTask: TaskRecord | undefined;
}

export function TaskDragOverlay({ activeTask }: TaskDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeTask ? (
        <div className="rounded-xl border border-accent bg-card p-3 opacity-90 shadow-lg">
          <p className="text-sm font-medium text-foreground truncate">{activeTask.title}</p>
          {activeTask.tags.length > 0 && (
            <div className="mt-1.5 flex gap-1 overflow-hidden">
              {activeTask.tags.slice(0, 3).map(tag => (
                <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{tag}</span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </DragOverlay>
  );
}
