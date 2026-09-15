"use client";

import { CheckIcon, MoonIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { SWIPE_CONFIG } from "@/lib/constants";
import { QUADRANT_ACCENT } from "@/lib/quadrants";
import type { TaskCardProps } from "@/lib/task-card-memo";
import { TaskCard } from "@/components/task-card/index";
import { SwipeActionRow, type SwipeAction } from "@/components/task-card/swipe-action-row";

/**
 * A task card with the matrix's touch swipe actions: leading Complete (full swipe
 * commits), trailing Snooze one hour then Delete. Same verbs, order, and tints as
 * the iOS matrix, so a user moving between phone and browser meets one gesture
 * vocabulary. Every action goes through the same handler its button uses, so
 * swipe Complete gets the confetti and Undo, and swipe Delete gets the Undo toast.
 */
export function SwipeableTaskCard(props: TaskCardProps) {
  const { task, onToggleComplete, onSnooze, onDelete } = props;

  const leading: SwipeAction = task.completed
    ? { label: "Uncomplete", icon: Undo2Icon, ground: "var(--status-success)", testId: "swipe-complete", onAction: () => onToggleComplete(task, false) }
    : { label: "Complete", icon: CheckIcon, ground: "var(--status-success)", testId: "swipe-complete", onAction: () => onToggleComplete(task, true) };

  const trailing: SwipeAction[] = [
    { label: "Delete", ariaLabel: "Delete task", icon: Trash2Icon, ground: "var(--rust)", testId: "swipe-delete", onAction: () => onDelete(task) },
  ];
  if (onSnooze) {
    trailing.unshift({
      label: "Snooze",
      ariaLabel: "Snooze 1 hour",
      icon: MoonIcon,
      ground: QUADRANT_ACCENT.q4,
      testId: "swipe-snooze",
      onAction: () => onSnooze(task.id, SWIPE_CONFIG.SNOOZE_MINUTES),
    });
  }

  return (
    <SwipeActionRow rowId={task.id} leading={leading} trailing={trailing}>
      <TaskCard {...props} />
    </SwipeActionRow>
  );
}
