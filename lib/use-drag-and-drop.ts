import { useState } from "react";
import { useSensors, useSensor, PointerSensor, TouchSensor, KeyboardSensor, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import type { Announcements } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { moveTaskToQuadrant } from "@/lib/tasks";
import { containerOf, quadrantTitle, resolveDropQuadrant } from "@/lib/dnd-drop-target";
import { DND_CONFIG } from "@/lib/constants";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";

/**
 * Error handler type for drag-and-drop operations
 */
export type DragErrorHandler = (
  error: unknown,
  context: {
    action: string;
    taskId: string;
    userMessage: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }
) => void;

/**
 * dnd-kit's default `onDragEnd` announcement claims the item was "dropped over"
 * the target the moment the gesture ends — before the write has resolved, and
 * regardless of whether it succeeds. These report intent only; the outcome is
 * announced separately once it is actually known.
 */
const DRAG_ANNOUNCEMENTS: Announcements = {
  onDragStart: ({ active }) => `Picked up task ${active.id}.`,
  onDragOver: ({ over }) => {
    const quadrant = resolveDropQuadrant(over);
    return quadrant ? `Over ${quadrantTitle(quadrant)}.` : "Not over a quadrant.";
  },
  onDragEnd: ({ over }) => {
    const quadrant = resolveDropQuadrant(over);
    return quadrant ? `Dropped over ${quadrantTitle(quadrant)}. Moving…` : "Drop cancelled.";
  },
  onDragCancel: () => "Drag cancelled. Task returned to its quadrant.",
};

/**
 * Mouse, touch, and keyboard sensors. The KeyboardSensor makes the drag handle
 * operable without a pointer (WCAG 2.1.1); sortableKeyboardCoordinates drives
 * arrow-key movement within the sortable list.
 */
function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_CONFIG.POINTER_DISTANCE },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: DND_CONFIG.TOUCH_DELAY,
        tolerance: DND_CONFIG.TOUCH_TOLERANCE,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

/**
 * Custom hook for drag-and-drop functionality in MatrixBoard
 * Configures sensors and provides drag handler with error handling
 */
export function useDragAndDrop(onError: DragErrorHandler) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Announced after the write settles, so assistive tech never hears "moved"
  // for a move that threw. Rendered into an sr-only live region by the board.
  const [statusMessage, setStatusMessage] = useState("");
  const sensors = useDragSensors();

  /**
   * Track which task is being dragged for DragOverlay
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setStatusMessage("");
  };

  /**
   * Handle drag end event - moves task to new quadrant
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const targetQuadrant = resolveDropQuadrant(over);
    if (!targetQuadrant || containerOf(active) === targetQuadrant) {
      return;
    }

    const taskId = active.id as string;

    try {
      await moveTaskToQuadrant(taskId, targetQuadrant);
      setStatusMessage(`Task moved to ${quadrantTitle(targetQuadrant)}.`);
    } catch (error) {
      setStatusMessage(ErrorMessages.TASK_MOVE_FAILED);
      onError(error, {
        action: ErrorActions.MOVE_TASK,
        taskId,
        userMessage: ErrorMessages.TASK_MOVE_FAILED,
        timestamp: new Date().toISOString(),
        metadata: { targetQuadrant },
      });
    }
  };

  return {
    sensors,
    activeId,
    statusMessage,
    announcements: DRAG_ANNOUNCEMENTS,
    handleDragStart,
    handleDragEnd,
  };
}
