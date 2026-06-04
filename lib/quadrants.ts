import type { QuadrantId } from "@/lib/types";

export type RedesignQuadrantKey = "q1" | "q2" | "q3" | "q4";

/** Canonical accent token per quadrant - single source of truth for charts, panes, and inline styles.
 *  References the first-class quadrant pigments (the editorial four-color language), decoupled from
 *  semantic tokens: q3 is ochre (not --olive/success-green) and q4 is slate (not --warning/amber). */
export const QUADRANT_ACCENT: Record<RedesignQuadrantKey, string> = {
  q1: "var(--q1)",
  q2: "var(--q2)",
  q3: "var(--q3)",
  q4: "var(--q4)",
};

/** Same palette keyed by QuadrantId for components that reference the long-form id. */
export const QUADRANT_ACCENT_BY_ID: Record<QuadrantId, string> = {
  "urgent-important": "var(--q1)",
  "not-urgent-important": "var(--q2)",
  "urgent-not-important": "var(--q3)",
  "not-urgent-not-important": "var(--q4)",
};
export type RedesignIconKey = "flame" | "calendar" | "users" | "trash";

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
  // Redesign metadata (prototype port)
  rdKey: RedesignQuadrantKey;
  rdShort: string; // "Do", "Plan", "Hand", "Drop"
  rdTag: string; // "Urgent & important"
  rdHint: string; // "Crises, deadlines. Handle now."
  rdIcon: RedesignIconKey;
  rdEmpty: string;
  /** Editorial serif headline shown in the empty quadrant pane. */
  rdEmptyHeadline: string;
  /** Body copy under the headline in the empty quadrant pane. */
  rdEmptySupporting: string;
  urgent: boolean;
  important: boolean;
}

export const quadrants: QuadrantMeta[] = [
  {
    id: "urgent-important",
    title: "Do First",
    subtitle: "High urgency, high impact tasks",
    accentClass: "bg-status-overdue-muted text-status-overdue",
    bgClass: "bg-quadrant-focus",
    colorClass: "bg-status-overdue",
    iconColor: "text-status-overdue",
    emptyMessage: "What needs your attention right now?",
    emptyEmoji: "🎯",
    emptyHeadline: "No urgent tasks right now",
    emptyDescription: "Great! You're on top of your critical work. Tasks that need immediate attention will appear here.",
    emptyCta: "Add urgent task",
    rdKey: "q1",
    rdShort: "Do",
    rdTag: "Urgent & important",
    rdHint: "Crises, deadlines. Handle now.",
    rdIcon: "flame",
    rdEmpty: "Clear. Nothing urgent demanding you right now.",
    rdEmptyHeadline: "Nothing on fire.",
    rdEmptySupporting: "Stay sharp.",
    urgent: true,
    important: true,
  },
  {
    id: "not-urgent-important",
    title: "Schedule",
    subtitle: "Plan meaningful progress",
    accentClass: "bg-accent-muted text-accent",
    bgClass: "bg-quadrant-schedule",
    colorClass: "bg-accent",
    iconColor: "text-accent",
    emptyMessage: "What's important but not urgent?",
    emptyEmoji: "📅",
    emptyHeadline: "Nothing scheduled yet",
    emptyDescription: "Plan important but not urgent tasks here. These are your strategic priorities that build long-term value.",
    emptyCta: "Schedule a task",
    rdKey: "q2",
    rdShort: "Plan",
    rdTag: "Important, not urgent",
    rdHint: "Strategy, growth. Protect time.",
    rdIcon: "calendar",
    rdEmpty: "Plan something meaningful. This is where growth lives.",
    rdEmptyHeadline: "Plan the week.",
    rdEmptySupporting: "What's important but not on fire? Block time before it becomes urgent.",
    urgent: false,
    important: true,
  },
  {
    id: "urgent-not-important",
    title: "Delegate",
    subtitle: "Hand off quick wins",
    accentClass: "bg-status-success-muted text-status-success",
    bgClass: "bg-quadrant-delegate",
    colorClass: "bg-status-success",
    iconColor: "text-status-success",
    emptyMessage: "What can someone else handle?",
    emptyEmoji: "🤝",
    emptyHeadline: "No delegated tasks",
    emptyDescription: "Tasks that are urgent but could be handled by others go here. Delegation helps you focus on what matters most.",
    emptyCta: "Add task to delegate",
    rdKey: "q3",
    rdShort: "Hand",
    rdTag: "Urgent, not important",
    rdHint: "Interruptions. Hand these off.",
    rdIcon: "users",
    rdEmpty: "Nothing to hand off.",
    rdEmptyHeadline: "Hand it off.",
    rdEmptySupporting: "Save your attention for the matrix. Route interruptions elsewhere.",
    urgent: true,
    important: false,
  },
  {
    id: "not-urgent-not-important",
    title: "Eliminate",
    subtitle: "Reduce noise and distractors",
    accentClass: "bg-status-blocked-muted text-status-blocked",
    bgClass: "bg-quadrant-eliminate",
    colorClass: "bg-status-blocked",
    iconColor: "text-status-blocked",
    emptyMessage: "Anything you can let go of?",
    emptyEmoji: "🗑️",
    emptyHeadline: "Nothing to eliminate",
    emptyDescription: "Perfect! You're avoiding time-wasters. Tasks here should be minimized or removed entirely.",
    emptyCta: "Add low-priority task",
    rdKey: "q4",
    rdShort: "Drop",
    rdTag: "Neither",
    rdHint: "Noise. Stop doing these.",
    rdIcon: "trash",
    rdEmpty: "No noise to clear. Good.",
    rdEmptyHeadline: "No noise to clear.",
    rdEmptySupporting: "Good.",
    urgent: false,
    important: false,
  }
];

export function quadrantByRdKey(key: RedesignQuadrantKey): QuadrantMeta {
  const found = quadrants.find((q) => q.rdKey === key);
  if (!found) throw new Error(`Unknown redesign quadrant key: ${key}`);
  return found;
}

export function quadrantForTask(urgent: boolean, important: boolean): QuadrantMeta {
  const id = resolveQuadrantId(urgent, important);
  const found = quadrants.find((q) => q.id === id);
  if (!found) throw new Error(`Unknown quadrant id: ${id}`);
  return found;
}

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
