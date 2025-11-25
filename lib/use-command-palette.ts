import { useState, useEffect, useMemo, useCallback } from "react";
import type { CommandAction } from "@/lib/command-actions";
import type { TaskRecord } from "@/lib/types";
import { applyFilters } from "@/lib/filters";

interface UseCommandPaletteOptions {
  actions: CommandAction[];
  tasks: TaskRecord[];
}

/**
 * Hook to manage command palette state and filtering
 */
export function useCommandPalette({ actions, tasks }: UseCommandPaletteOptions) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

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
  }, [open]);

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedActionId(null);
    }
  }, [open]);

  // Filter actions by search query
  const filteredActions = useMemo(() => {
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
  }, [search, actions]);

  // Filter tasks by search query (only show if search is 2+ chars)
  const matchingTasks = useMemo(() => {
    if (!search || search.length < 2) return [];

    // Use the existing filter system to search tasks
    const results = applyFilters(tasks, {
      searchQuery: search,
      status: 'active' // Only show active tasks in command palette
    });

    // Limit to top 10 matches
    return results.slice(0, 10);
  }, [search, tasks]);

  // Execute an action and close palette
  const executeAction = useCallback((action: CommandAction) => {
    action.onExecute();
    setOpen(false);
    setSearch('');
  }, []);

  // Handle task selection (navigate to matrix and highlight)
  const selectTask = useCallback((taskId: string) => {
    // Dispatch event for matrix to handle highlighting
    window.dispatchEvent(new CustomEvent('highlightTask', {
      detail: { taskId }
    }));

    setOpen(false);
    setSearch('');
  }, []);

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
