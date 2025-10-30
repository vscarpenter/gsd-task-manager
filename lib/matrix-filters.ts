import { quadrantOrder } from "@/lib/quadrants";
import { applyFilters } from "@/lib/filters";
import type { FilterCriteria } from "@/lib/filters";
import type { TaskRecord, QuadrantId } from "@/lib/types";

/**
 * Extract all unique tags from a list of tasks
 */
export function extractAvailableTags(tasks: TaskRecord[]): string[] {
  const tagSet = new Set<string>();
  tasks.forEach((task) => task.tags.forEach((tag) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

/**
 * Filter and group tasks by quadrant
 * Applies search query and filter criteria, respecting completed task visibility
 */
export function getFilteredQuadrants(
  allTasks: TaskRecord[],
  filterCriteria: FilterCriteria,
  searchQuery: string,
  showCompleted: boolean
): Record<QuadrantId, TaskRecord[]> {
  // Merge search query and completed status into filter criteria
  const criteriaWithSearch: FilterCriteria = {
    ...filterCriteria,
    searchQuery: searchQuery.trim() || undefined,
    // Only override status if Smart View doesn't specify one
    status: filterCriteria.status || (showCompleted ? "all" : "active"),
  };

  // Apply all filters
  const filtered = applyFilters(allTasks, criteriaWithSearch);

  // Group filtered tasks by quadrant
  return Object.fromEntries(
    quadrantOrder.map((id) => [id, filtered.filter((task) => task.quadrant === id)])
  ) as Record<QuadrantId, TaskRecord[]>;
}

/**
 * Calculate total count of visible tasks across all quadrants
 */
export function getVisibleTaskCount(filteredQuadrants: Record<QuadrantId, TaskRecord[]>): number {
  return quadrantOrder.reduce((total, id) => total + (filteredQuadrants[id]?.length ?? 0), 0);
}
