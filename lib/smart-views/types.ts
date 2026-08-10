import type { QuadrantId, RecurrenceType } from "@/lib/types";

/** Criteria supported by task filters and persisted smart views. */
export interface FilterCriteria {
  quadrants?: QuadrantId[];
  status?: "all" | "active" | "completed";
  tags?: string[];
  dueDateRange?: {
    start?: string;
    end?: string;
  };
  overdue?: boolean;
  dueToday?: boolean;
  dueThisWeek?: boolean;
  noDueDate?: boolean;
  recurrence?: RecurrenceType[];
  recentlyAdded?: boolean;
  recentlyCompleted?: boolean;
  readyToWork?: boolean;
  searchQuery?: string;
}

/** A named, persisted filter configuration. */
export interface SmartView {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  criteria: FilterCriteria;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}
