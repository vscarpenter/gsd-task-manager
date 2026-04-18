"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard, type TaskCardProps } from "./task-card";

/**
 * Wraps a TaskCard so the whole card becomes a drag source.
 * An 8px activation distance (from DND_CONFIG.POINTER_DISTANCE via the
 * pointer sensor) prevents clicks from being interpreted as drags —
 * so the card's onClick (which opens the composer in edit mode) still
 * fires on a plain click.
 */
export function DraggableTaskCard(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        cursor: isDragging ? "grabbing" : undefined,
        touchAction: "manipulation",
      }}
    >
      <TaskCard {...props} />
    </div>
  );
}
