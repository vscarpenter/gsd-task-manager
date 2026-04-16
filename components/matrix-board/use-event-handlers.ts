/**
 * Event handlers for the Matrix Board
 */

import { useCallback, useEffect, type RefObject } from "react";
import { getPinnedSmartViews } from "@/lib/smart-views";
import { notificationChecker } from "@/lib/notification-checker";
import { UI_TIMING } from "@/lib/constants/ui";
import type { FilterCriteria, SmartView } from "@/lib/filters";

interface TaskHighlightRefs {
  taskRefs: RefObject<Map<string, HTMLElement>>;
}

/**
 * Scroll to a task element and temporarily highlight it.
 * Consolidates the repeated scroll+highlight pattern used by
 * both command palette highlighting and URL highlight params.
 */
function scrollToAndHighlightTask(
  taskId: string,
  setHighlightedTaskId: (id: string | null) => void,
  taskRefs: RefObject<Map<string, HTMLElement>>,
  onClearExtras?: () => void,
): void {
  setHighlightedTaskId(taskId);

  // Scroll to task after render
  setTimeout(() => {
    const taskElement = taskRefs.current?.get(taskId);
    if (taskElement) {
      taskElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, UI_TIMING.SCROLL_TO_TASK_DELAY_MS);

  // Clear highlight after animation completes
  setTimeout(() => {
    setHighlightedTaskId(null);
    onClearExtras?.();
  }, UI_TIMING.TASK_HIGHLIGHT_DURATION_MS);
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
      scrollToAndHighlightTask(event.detail.taskId, setHighlightedTaskId, refs.taskRefs);
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
  useUrlActionHandlers(setDialogState);
}

/**
 * Hook to handle URL-driven actions like opening the create dialog or help.
 */
export function useUrlActionHandlers(
  setDialogState: (state: { mode: "create" }) => void,
  openHelpDialog?: () => void
): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");

    if (action === "new-task") {
      setDialogState({ mode: "create" });
      params.delete("action");
      const nextQuery = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
      );
      return;
    }

    if (action === "help" && openHelpDialog) {
      openHelpDialog();
      params.delete("action");
      const nextQuery = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
      );
      return;
    }

    if (action) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [openHelpDialog, setDialogState]);
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
      scrollToAndHighlightTask(
        highlightId,
        setHighlightedTaskId,
        refs.taskRefs,
        () => window.history.replaceState({}, "", window.location.pathname),
      );
    }
  }, [allTasksLength, setHighlightedTaskId, refs.taskRefs]);
}

/**
 * Hook to hydrate matrix search from a URL query parameter.
 */
export function useUrlSearchQueryParam(
  setSearchQuery: (query: string) => void
): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q");

    if (urlQuery) {
      setSearchQuery(urlQuery);
    }
  }, [setSearchQuery]);
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
