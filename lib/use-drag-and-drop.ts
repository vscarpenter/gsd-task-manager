import { useSensors, useSensor, PointerSensor, TouchSensor, DragEndEvent } from "@dnd-kit/core";
import type { QuadrantId } from "@/lib/types";
import { moveTaskToQuadrant } from "@/lib/tasks";
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
 * Custom hook for drag-and-drop functionality in MatrixBoard
 * Configures sensors and provides drag handler with error handling
 */
export function useDragAndDrop(onError: DragErrorHandler) {
  // Configure sensors for drag-and-drop (mouse + touch)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DND_CONFIG.POINTER_DISTANCE,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: DND_CONFIG.TOUCH_DELAY,
        tolerance: DND_CONFIG.TOUCH_TOLERANCE,
      },
    })
  );

  /**
   * Handle drag end event - moves task to new quadrant
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const taskId = active.id as string;
    const targetQuadrant = over.id as QuadrantId;

    try {
      await moveTaskToQuadrant(taskId, targetQuadrant);
    } catch (error) {
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
    handleDragEnd,
  };
}
