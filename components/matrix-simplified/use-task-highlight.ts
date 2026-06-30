/**
 * Transient "highlight + scroll to" behavior for a single task — used when a
 * deep link or shell command points at a specific task. Extracted from
 * MatrixSimplified so the ref-tracking and timer lifecycle live in one place.
 */

import { useEffect, useRef, useState } from "react";
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
  const taskRefsRef = useRef<Map<string, HTMLElement> | null>(null);
  const clearHighlightTimerRef = useRef<number | null>(null);

  // Lazily initialize the ref map so a fresh Map isn't allocated on every render.
  // (Plain if-assignment rather than `??=`, which the React Compiler can't lower.)
  const getTaskRefs = () => {
    if (!taskRefsRef.current) {
      taskRefsRef.current = new Map<string, HTMLElement>();
    }
    return taskRefsRef.current;
  };

  const handleTaskRef = (taskId: string, element: HTMLElement | null) => {
    const taskRefs = getTaskRefs();
    if (element) {
      taskRefs.set(taskId, element);
    } else {
      taskRefs.delete(taskId);
    }
  };

  const highlightTaskById = (taskId: string) => {
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
  };

  useEffect(() => {
    // Capture the timer id at effect-run time so cleanup clears the value this
    // effect closed over, not whatever the ref happens to hold at unmount.
    const timerId = clearHighlightTimerRef.current;
    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [highlightedTaskId]);

  // Scroll the targeted task into view once it has (re)rendered. Inlined here
  // (rather than a separate callback) so the effect has a stable dependency set
  // and doesn't re-run on every render via a recreated function reference.
  useEffect(() => {
    if (!highlightedTaskId) return;

    const frame = window.requestAnimationFrame(() => {
      const node = getTaskRefs().get(highlightedTaskId);
      if (!node) return;

      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
      node.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
    // visibleTasks re-triggers the scroll after the task list re-renders.
     
  }, [highlightedTaskId, visibleTasks]);

  return { highlightedTaskId, handleTaskRef, highlightTaskById };
}
