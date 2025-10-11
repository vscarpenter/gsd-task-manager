"use client";

import { useTasks } from "@/lib/use-tasks";

/**
 * Extract all unique tags from all tasks
 *
 * Returns a sorted array of unique tag strings that have been used
 * across all tasks in the database. Updates live as tasks change.
 *
 * @returns Array of unique tag strings, sorted alphabetically
 */
export function useAllTags(): string[] {
  const { all: tasks } = useTasks();

  // Flatten all tags from all tasks
  const allTags = tasks.flatMap((task) => task.tags || []);

  // Deduplicate using Set
  const uniqueTags = Array.from(new Set(allTags));

  // Sort alphabetically for consistent ordering
  return uniqueTags.sort((a, b) => a.localeCompare(b));
}
