import type { QuadrantId } from "@/lib/types";

export interface QuadrantMeta {
  id: QuadrantId;
  title: string;
  subtitle: string;
  accentClass: string;
  bgClass: string;
  colorClass: string;
  iconColor: string;
}

export const quadrants: QuadrantMeta[] = [
  {
    id: "urgent-important",
    title: "Do First",
    subtitle: "High urgency, high impact tasks",
    accentClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    bgClass: "bg-quadrant-focus",
    colorClass: "bg-blue-500",
    iconColor: "text-blue-500 dark:text-blue-400"
  },
  {
    id: "not-urgent-important",
    title: "Schedule",
    subtitle: "Plan meaningful progress",
    accentClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bgClass: "bg-quadrant-schedule",
    colorClass: "bg-amber-500",
    iconColor: "text-amber-500 dark:text-amber-400"
  },
  {
    id: "urgent-not-important",
    title: "Delegate",
    subtitle: "Hand off quick wins",
    accentClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    bgClass: "bg-quadrant-delegate",
    colorClass: "bg-emerald-500",
    iconColor: "text-emerald-500 dark:text-emerald-400"
  },
  {
    id: "not-urgent-not-important",
    title: "Eliminate",
    subtitle: "Reduce noise and distractors",
    accentClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    bgClass: "bg-quadrant-eliminate",
    colorClass: "bg-purple-500",
    iconColor: "text-purple-500 dark:text-purple-400"
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

export function quadrantLabel(id: QuadrantId): string {
  return quadrants.find((quadrant) => quadrant.id === id)?.title ?? "Unknown";
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
