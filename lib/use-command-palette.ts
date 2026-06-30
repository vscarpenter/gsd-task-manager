import { useReducer, useEffect } from "react";
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

  // Open/close with ⌘K / Ctrl+K, Escape to close. `dispatch` is stable, so the
  // listener subscribes once.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dispatch({ type: "toggle" });
      } else if (e.key === 'Escape') {
        dispatch({ type: "close" });
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const openPalette = () => dispatch({ type: "open" });
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
  }, []);

  const setOpen = (next: boolean | ((previous: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    dispatch(resolved ? { type: "open" } : { type: "close" });
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
    action.onExecute();
    setOpen(false);
  };

  // Handle task selection (navigate to matrix and highlight)
  const selectTask = (taskId: string) => {
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
