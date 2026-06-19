/**
 * Transient "highlight + scroll to" behavior for a single task — used when a
 * deep link or shell command points at a specific task. Extracted from
 * MatrixSimplified so the ref-tracking and timer lifecycle live in one place.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskRecord } from "@/lib/types";

/** How long a task stays visually highlighted after being targeted. */
const HIGHLIGHT_DURATION_MS = 3500;

export interface TaskHighlight {
  highlightedTaskId: string | null;
  handleTaskRef: (taskId: string, element: HTMLElement | null) => void;
  highlightTaskById: (taskId: string) => void;
}

/**
 * @param visibleTasks re-triggers the scroll once the targeted task has
 *   (re)rendered into the list.
 * @param clearSearch clears any active search so the highlighted task is not
 *   hidden by a stale filter (matches the matrix's existing behavior).
 */
export function useTaskHighlight(
  visibleTasks: TaskRecord[],
  clearSearch: () => void
): TaskHighlight {
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const taskRefs = useRef(new Map<string, HTMLElement>());
  const clearHighlightTimerRef = useRef<number | null>(null);

  const handleTaskRef = useCallback((taskId: string, element: HTMLElement | null) => {
    if (element) {
      taskRefs.current.set(taskId, element);
    } else {
      taskRefs.current.delete(taskId);
    }
  }, []);

  const scrollTaskIntoView = useCallback((taskId: string) => {
    const node = taskRefs.current.get(taskId);
    if (!node) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    node.focus({ preventScroll: true });
  }, []);

  const highlightTaskById = useCallback(
    (taskId: string) => {
      if (!taskId) return;

      clearSearch();
      setHighlightedTaskId(taskId);

      if (clearHighlightTimerRef.current) {
        window.clearTimeout(clearHighlightTimerRef.current);
      }
      clearHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedTaskId((current) => (current === taskId ? null : current));
        clearHighlightTimerRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
    },
    [clearSearch]
  );

  useEffect(() => {
    return () => {
      if (clearHighlightTimerRef.current) {
        window.clearTimeout(clearHighlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!highlightedTaskId) return;

    const frame = window.requestAnimationFrame(() => {
      scrollTaskIntoView(highlightedTaskId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedTaskId, scrollTaskIntoView, visibleTasks]);

  return { highlightedTaskId, handleTaskRef, highlightTaskById };
}
