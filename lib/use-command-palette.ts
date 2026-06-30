import { useState, useEffect } from "react";
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

/**
 * Hook to manage command palette state and filtering
 */
export function useCommandPalette({ actions, tasks, onSelectTask }: UseCommandPaletteOptions) {
  const [open, setOpenState] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const setOpen = (next: boolean | ((previous: boolean) => boolean)) => {
    setOpenState((previous) => {
      const resolved = typeof next === 'function' ? next(previous) : next;
      if (!resolved) {
        setSearch('');
        setSelectedActionId(null);
      }
      return resolved;
    });
  };

  // Open/close with ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }

      // Escape to close
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  useEffect(() => {
    const openPalette = () => setOpen(true);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
  }, [setOpen]);

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
