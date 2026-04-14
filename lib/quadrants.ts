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
    accentClass: "bg-[#f9e3e0] text-[#c94b3a] dark:bg-[#763632]/55 dark:text-[#f3b2a8]",
    bgClass: "bg-quadrant-focus",
    colorClass: "bg-[#e74f43] dark:bg-[#f08b78]",
    iconColor: "text-[#e74f43] dark:text-[#f5b0a4]",
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
    accentClass: "bg-[#e3ebff] text-[#4f73e8] dark:bg-[#374a78]/55 dark:text-[#b9c9ff]",
    bgClass: "bg-quadrant-schedule",
    colorClass: "bg-[#4d74f5] dark:bg-[#7ea0ff]",
    iconColor: "text-[#4d74f5] dark:text-[#abc1ff]",
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
    accentClass: "bg-[#e1f2e9] text-[#31996f] dark:bg-[#315548]/55 dark:text-[#a5dec2]",
    bgClass: "bg-quadrant-delegate",
    colorClass: "bg-[#36c28a] dark:bg-[#71d4a9]",
    iconColor: "text-[#36c28a] dark:text-[#9fe6c3]",
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
    accentClass: "bg-[#fdebcf] text-[#c07a12] dark:bg-[#6c4d21]/55 dark:text-[#ffd08a]",
    bgClass: "bg-quadrant-eliminate",
    colorClass: "bg-[#ff9800] dark:bg-[#ffc15a]",
    iconColor: "text-[#ff9800] dark:text-[#ffd58f]",
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
