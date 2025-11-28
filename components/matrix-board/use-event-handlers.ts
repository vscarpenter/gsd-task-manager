/**
 * Event handlers for the Matrix Board
 */

import { useCallback, useEffect, type RefObject } from "react";
import { getPinnedSmartViews } from "@/lib/smart-views";
import { notificationChecker } from "@/lib/notification-checker";
import type { FilterCriteria, SmartView } from "@/lib/filters";

interface TaskHighlightRefs {
  taskRefs: RefObject<Map<string, HTMLElement>>;
}

/**
 * Hook to load and listen for pinned smart view changes
 */
export function usePinnedSmartViews(
  setPinnedSmartViews: (views: SmartView[]) => void
): void {
  useEffect(() => {
    const loadPinnedViews = async () => {
      const views = await getPinnedSmartViews();
      setPinnedSmartViews(views);
    };

    loadPinnedViews();

    const handlePinnedViewsChanged = () => {
      loadPinnedViews();
    };

    window.addEventListener("pinnedViewsChanged", handlePinnedViewsChanged);
    return () => window.removeEventListener("pinnedViewsChanged", handlePinnedViewsChanged);
  }, [setPinnedSmartViews]);
}

/**
 * Hook to listen for Quick Settings show completed toggle
 */
export function useToggleCompletedListener(
  setShowCompleted: (show: boolean) => void
): void {
  useEffect(() => {
    const handleToggleCompleted = (event: CustomEvent) => {
      setShowCompleted(event.detail.show);
    };

    window.addEventListener("toggle-completed", handleToggleCompleted as EventListener);
    return () =>
      window.removeEventListener("toggle-completed", handleToggleCompleted as EventListener);
  }, [setShowCompleted]);
}

/**
 * Hook to handle task highlighting from Command Palette
 */
export function useTaskHighlighting(
  setHighlightedTaskId: (id: string | null) => void,
  refs: TaskHighlightRefs
): void {
  useEffect(() => {
    const handleHighlightTask = (event: CustomEvent<{ taskId: string }>) => {
      const taskId = event.detail.taskId;
      setHighlightedTaskId(taskId);

      // Scroll to task after render
      setTimeout(() => {
        const taskElement = refs.taskRefs.current?.get(taskId);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);

      // Clear highlight after animation completes
      setTimeout(() => {
        setHighlightedTaskId(null);
      }, 3000);
    };

    window.addEventListener("highlightTask", handleHighlightTask as EventListener);
    return () =>
      window.removeEventListener("highlightTask", handleHighlightTask as EventListener);
  }, [setHighlightedTaskId, refs.taskRefs]);
}

/**
 * Hook to start and stop notification checker
 */
export function useNotificationChecker(): void {
  useEffect(() => {
    notificationChecker.start();
    return () => {
      notificationChecker.stop();
    };
  }, []);
}

/**
 * Hook to handle PWA shortcut for new task
 */
export function usePwaNewTaskShortcut(
  setDialogState: (state: { mode: "create" }) => void
): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new-task") {
      setDialogState({ mode: "create" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setDialogState]);
}

/**
 * Hook to handle URL highlight parameter from dashboard
 */
export function useUrlHighlightParam(
  allTasksLength: number,
  setHighlightedTaskId: (id: string | null) => void,
  refs: TaskHighlightRefs
): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get("highlight");

    if (highlightId) {
      setHighlightedTaskId(highlightId);

      // Wait for tasks to render, then scroll to highlighted task
      setTimeout(() => {
        const taskElement = refs.taskRefs.current?.get(highlightId);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);

      // Clear highlight after animation completes
      setTimeout(() => {
        setHighlightedTaskId(null);
        window.history.replaceState({}, "", window.location.pathname);
      }, 3000);
    }
  }, [allTasksLength, setHighlightedTaskId, refs.taskRefs]);
}

/**
 * Smart view selection handlers
 */
export function useSmartViewHandlers(
  setFilterCriteria: (criteria: FilterCriteria) => void,
  setSearchQuery: (query: string) => void,
  setActiveSmartViewId: (id: string | null) => void
) {
  const handleSelectSmartView = useCallback(
    (criteria: FilterCriteria) => {
      setFilterCriteria(criteria);
      setSearchQuery("");
    },
    [setFilterCriteria, setSearchQuery]
  );

  const handleClearSmartView = useCallback(() => {
    setFilterCriteria({});
    setSearchQuery("");
    setActiveSmartViewId(null);
  }, [setFilterCriteria, setSearchQuery, setActiveSmartViewId]);

  return { handleSelectSmartView, handleClearSmartView };
}
