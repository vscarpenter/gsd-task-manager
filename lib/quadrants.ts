import type { QuadrantId } from "@/lib/types";

export interface QuadrantMeta {
  id: QuadrantId;
  title: string;
  subtitle: string;
  accentClass: string;
  bgClass: string;
  colorClass: string;
  iconColor: string;
  emptyMessage: string;
  emptyEmoji: string;
  emptyHeadline: string;
  emptyDescription: string;
  emptyCta: string;
}

export const quadrants: QuadrantMeta[] = [
  {
    id: "urgent-important",
    title: "Do First",
    subtitle: "High urgency, high impact tasks",
    accentClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    bgClass: "bg-quadrant-focus",
    colorClass: "bg-red-500",
    iconColor: "text-red-500 dark:text-red-400",
    emptyMessage: "What needs your attention right now?",
    emptyEmoji: "🎯",
    emptyHeadline: "No urgent tasks right now",
    emptyDescription: "Great! You're on top of your critical work. Tasks that need immediate attention will appear here.",
    emptyCta: "Add urgent task"
  },
  {
    id: "not-urgent-important",
    title: "Schedule",
    subtitle: "Plan meaningful progress",
    accentClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    bgClass: "bg-quadrant-schedule",
    colorClass: "bg-blue-500",
    iconColor: "text-blue-500 dark:text-blue-400",
    emptyMessage: "What's important but not urgent?",
    emptyEmoji: "📅",
    emptyHeadline: "Nothing scheduled yet",
    emptyDescription: "Plan important but not urgent tasks here. These are your strategic priorities that build long-term value.",
    emptyCta: "Schedule a task"
  },
  {
    id: "urgent-not-important",
    title: "Delegate",
    subtitle: "Hand off quick wins",
    accentClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bgClass: "bg-quadrant-delegate",
    colorClass: "bg-amber-500",
    iconColor: "text-amber-500 dark:text-amber-400",
    emptyMessage: "What can someone else handle?",
    emptyEmoji: "🤝",
    emptyHeadline: "No delegated tasks",
    emptyDescription: "Tasks that are urgent but could be handled by others go here. Delegation helps you focus on what matters most.",
    emptyCta: "Add task to delegate"
  },
  {
    id: "not-urgent-not-important",
    title: "Eliminate",
    subtitle: "Reduce noise and distractors",
    accentClass: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
    bgClass: "bg-quadrant-eliminate",
    colorClass: "bg-gray-500",
    iconColor: "text-gray-500 dark:text-gray-400",
    emptyMessage: "Anything you can let go of?",
    emptyEmoji: "🗑️",
    emptyHeadline: "Nothing to eliminate",
    emptyDescription: "Perfect! You're avoiding time-wasters. Tasks here should be minimized or removed entirely.",
    emptyCta: "Add low-priority task"
  }
];

export const quadrantOrder: QuadrantId[] = quadrants.map((q) => q.id);

export function resolveQuadrantId(urgent: boolean, important: boolean): QuadrantId {
  if (urgent && important) {
    return "urgent-important";
  }
  if (!urgent && important) {
    return "not-urgent-important";
  }
  if (urgent && !important) {
    return "urgent-not-important";
  }
  return "not-urgent-not-important";
}

/**
 * Parse quadrant ID back into urgent/important flags.
 * Inverse of resolveQuadrantId.
 */
export function parseQuadrantFlags(quadrantId: QuadrantId): { urgent: boolean; important: boolean } {
  switch (quadrantId) {
    case "urgent-important":
      return { urgent: true, important: true };
    case "not-urgent-important":
      return { urgent: false, important: true };
    case "urgent-not-important":
      return { urgent: true, important: false };
    case "not-urgent-not-important":
      return { urgent: false, important: false };
  }
}
