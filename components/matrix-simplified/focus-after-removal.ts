import type { TaskRecord } from "@/lib/types";

/**
 * The next card a keyboard user should land on after the current one leaves
 * the active list. Prefers the following open task in the same quadrant, then
 * the previous one.
 */
export function neighborFocusId(tasks: readonly TaskRecord[], removedId: string): string | null {
  const index = tasks.findIndex((task) => task.id === removedId);
  if (index < 0) return null;
  const removed = tasks[index];
  const sameQuadrant = (task: TaskRecord) =>
    task.id !== removedId &&
    !task.completed &&
    task.urgent === removed.urgent &&
    task.important === removed.important;

  const after = tasks.slice(index + 1).find(sameQuadrant);
  if (after) return after.id;
  const before = tasks.slice(0, index).reverse().find(sameQuadrant);
  return before?.id ?? null;
}

/** Move focus onto a card that is already in the document. */
export function focusTaskCard(taskId: string): boolean {
  if (typeof document === "undefined" || typeof CSS === "undefined") return false;
  const card = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
  if (!(card instanceof HTMLElement)) return false;
  const target = card.querySelector<HTMLElement>("button:not([disabled])") ?? card;
  target.focus();
  return document.activeElement === target;
}

/** Wait until the list has re-rendered without the removed card. */
export function scheduleCardFocus(taskId: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      focusTaskCard(taskId);
    });
  });
}
