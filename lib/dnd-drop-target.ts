import type { Active, Over } from "@dnd-kit/core";

import { quadrantOrder, quadrants } from "@/lib/quadrants";
import type { QuadrantId } from "@/lib/types";

function isQuadrantId(value: unknown): value is QuadrantId {
  return typeof value === "string" && (quadrantOrder as string[]).includes(value);
}

/** The SortableContext a draggable belongs to — the quadrant pane it sits in. */
export function containerOf(node: Active | Over | null): QuadrantId | null {
  const containerId = node?.data.current?.sortable?.containerId;
  return isQuadrantId(containerId) ? containerId : null;
}

/**
 * Resolve a drop target to the quadrant it belongs to.
 *
 * Two kinds of droppable overlap on this board: the quadrant panes and the task
 * cards inside them, since every card registers itself through `useSortable`.
 * Keyboard dragging resolves `over` to a neighbouring *card*, so treating
 * `over.id` as a quadrant id silently handed a task id to the write and every
 * keyboard drop failed. Cards resolve through their sortable container instead.
 *
 * Returns null when the target is neither — not a failure, just not a drop target.
 */
export function resolveDropQuadrant(over: Over | null): QuadrantId | null {
  if (!over) return null;
  if (isQuadrantId(over.id)) return over.id;
  return containerOf(over);
}

export function quadrantTitle(id: QuadrantId): string {
  return quadrants.find((quadrant) => quadrant.id === id)?.title ?? id;
}
