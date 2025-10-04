import type { QuadrantId } from "@/lib/types";

export interface QuadrantMeta {
  id: QuadrantId;
  title: string;
  subtitle: string;
  accentClass: string;
}

export const quadrants: QuadrantMeta[] = [
  {
    id: "urgent-important",
    title: "Do First",
    subtitle: "High urgency, high impact tasks",
    accentClass: "bg-quadrant-focus/25 text-quadrant-focus"
  },
  {
    id: "not-urgent-important",
    title: "Schedule",
    subtitle: "Plan meaningful progress",
    accentClass: "bg-quadrant-schedule/25 text-quadrant-schedule"
  },
  {
    id: "urgent-not-important",
    title: "Delegate",
    subtitle: "Hand off quick wins",
    accentClass: "bg-quadrant-delegate/25 text-quadrant-delegate"
  },
  {
    id: "not-urgent-not-important",
    title: "Eliminate",
    subtitle: "Reduce noise and distractors",
    accentClass: "bg-quadrant-eliminate/25 text-quadrant-eliminate"
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
