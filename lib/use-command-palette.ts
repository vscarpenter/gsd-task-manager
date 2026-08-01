import { useCallback, useEffect, useReducer, useRef } from "react";
import type { CommandAction } from "@/lib/command-actions";
import type { TaskRecord } from "@/lib/types";
import { applyFilters } from "@/lib/filters";
import { SEARCH_CONFIG } from "@/lib/constants/ui";

export const OPEN_COMMAND_PALETTE_EVENT = "gsd:open-command-palette";

interface UseCommandPaletteOptions {
  actions: CommandAction[];
  tasks: TaskRecord[];
  onSelectTask?: (taskId: string) => void;
}

interface PaletteState {
  open: boolean;
  search: string;
  selectedActionId: string | null;
}

type PaletteAction =
  | { type: "toggle" }
  | { type: "open" }
  | { type: "close" }
  | { type: "setSearch"; value: string }
  | { type: "setSelectedActionId"; value: string | null };

const INITIAL_PALETTE_STATE: PaletteState = { open: false, search: "", selectedActionId: null };

// Closing also clears the in-flight search and selection.
function paletteReducer(state: PaletteState, action: PaletteAction): PaletteState {
  switch (action.type) {
    case "toggle":
      return state.open ? INITIAL_PALETTE_STATE : { ...state, open: true };
    case "open":
      return { ...state, open: true };
    case "close":
      return INITIAL_PALETTE_STATE;
    case "setSearch":
      return { ...state, search: action.value };
    case "setSelectedActionId":
      return { ...state, selectedActionId: action.value };
  }
}

/**
 * Hook to manage command palette state and filtering
 */
export function useCommandPalette({ actions, tasks, onSelectTask }: UseCommandPaletteOptions) {
  const [state, dispatch] = useReducer(paletteReducer, INITIAL_PALETTE_STATE);
  const { open, search, selectedActionId } = state;
  const openRef = useRef(open);
  const wasOpenRef = useRef(open);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const rememberOpener = useCallback(() => {
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
      ? activeElement
      : null;
  }, []);

  const openPalette = useCallback(() => {
    if (!openRef.current) {
      rememberOpener();
    }
    openRef.current = true;
    dispatch({ type: "open" });
  }, [rememberOpener]);

  const closePalette = useCallback(() => {
    openRef.current = false;
    dispatch({ type: "close" });
  }, []);

  useEffect(() => {
    openRef.current = open;
    let restoreFrame: number | undefined;

    if (wasOpenRef.current && !open) {
      const returnTarget = returnFocusRef.current;
      returnFocusRef.current = null;
      // Radix releases dialog focus during its own close cleanup. Restore on
      // the next frame so WebKit cannot overwrite our earlier focus call, but
      // do not steal focus if the user has already moved to another control.
      restoreFrame = window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (
          returnTarget?.isConnected &&
          (activeElement === document.body ||
            activeElement === document.documentElement ||
            activeElement?.hasAttribute("data-radix-focus-guard"))
        ) {
          returnTarget.focus();
        }
      });
    }

    wasOpenRef.current = open;

    return () => {
      if (restoreFrame !== undefined) {
        window.cancelAnimationFrame(restoreFrame);
      }
    };
  }, [open]);

  // Open/close with ⌘K / Ctrl+K, Escape to close. `dispatch` is stable, so the
  // listener subscribes once.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (openRef.current) {
          closePalette();
        } else {
          openPalette();
        }
      } else if (e.key === 'Escape') {
        closePalette();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [closePalette, openPalette]);

  useEffect(() => {
    const onOpenPalette = () => openPalette();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenPalette);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenPalette);
  }, [openPalette]);

  const setOpen = (next: boolean | ((previous: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    if (resolved) {
      openPalette();
    } else {
      closePalette();
    }
  };
  const setSearch = (value: string) => dispatch({ type: "setSearch", value });
  const setSelectedActionId = (value: string | null) =>
    dispatch({ type: "setSelectedActionId", value });

  // Filter actions by search query
  const filteredActions = (() => {
    if (!search || search.length < 2) {
      // Show all actions when no search
      return actions.filter(action => !action.condition || action.condition());
    }

    const searchLower = search.toLowerCase();

    return actions.filter(action => {
      // Check condition
      if (action.condition && !action.condition()) return false;

      // Check label
      if (action.label.toLowerCase().includes(searchLower)) return true;

      // Check keywords
      return action.keywords.some(kw => kw.includes(searchLower));
    });
  })();

  // Filter tasks by search query (only show if search is 2+ chars)
  const matchingTasks = (() => {
    if (!search || search.length < 2) return [];

    // Use the existing filter system to search tasks
    const results = applyFilters(tasks, {
      searchQuery: search,
      status: 'active' // Only show active tasks in command palette
    });

    // Limit to top matches
    return results.slice(0, SEARCH_CONFIG.MAX_COMMAND_PALETTE_RESULTS);
  })();

  // Execute an action and close palette
  const executeAction = (action: CommandAction) => {
    // The action may navigate or open another focus-managed surface. In that
    // case its destination owns focus; returning to the palette opener would
    // steal focus back from the new context.
    if (action.focusAfterExecute === "handoff") {
      returnFocusRef.current = null;
    }
    action.onExecute();
    setOpen(false);
  };

  // Handle task selection (navigate to matrix and highlight)
  const selectTask = (taskId: string) => {
    returnFocusRef.current = null;
    if (onSelectTask) {
      onSelectTask(taskId);
      setOpen(false);
      return;
    }

    // Dispatch event for matrix to handle highlighting
    window.dispatchEvent(new CustomEvent('highlightTask', {
      detail: { taskId }
    }));

    setOpen(false);
  };

  return {
    open,
    setOpen,
    search,
    setSearch,
    filteredActions,
    matchingTasks,
    executeAction,
    selectTask,
    selectedActionId,
    setSelectedActionId
  };
}
