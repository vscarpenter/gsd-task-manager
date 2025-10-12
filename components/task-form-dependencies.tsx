"use client";

import { useState, useMemo } from "react";
import { XIcon, AlertCircleIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useTasks } from "@/lib/use-tasks";
import type { TaskRecord } from "@/lib/types";
import { wouldCreateCircularDependency } from "@/lib/dependencies";

interface TaskFormDependenciesProps {
  taskId?: string; // undefined for new tasks
  dependencies: string[];
  onChange: (dependencies: string[]) => void;
  error?: string;
}

/**
 * Dependency selector for task form
 * Allows selecting which tasks must be completed before this task
 */
export function TaskFormDependencies({
  taskId,
  dependencies,
  onChange,
  error
}: TaskFormDependenciesProps) {
  const { all: allTasks } = useTasks();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Get available tasks that can be added as dependencies
  const availableTasks = useMemo(() => {
    return allTasks.filter(task => {
      // Can't depend on itself
      if (taskId && task.id === taskId) return false;

      // Already added as dependency
      if (dependencies.includes(task.id)) return false;

      // Don't show completed tasks (they're already done)
      if (task.completed) return false;

      // Check if adding this would create a circular dependency
      if (taskId && wouldCreateCircularDependency(taskId, task.id, allTasks)) {
        return false;
      }

      return true;
    });
  }, [allTasks, dependencies, taskId]);

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return availableTasks;
    const query = searchQuery.toLowerCase();
    return availableTasks.filter(task =>
      task.title.toLowerCase().includes(query)
    );
  }, [availableTasks, searchQuery]);

  // Get task details for selected dependencies
  const selectedTasks = useMemo(() => {
    return dependencies
      .map(depId => allTasks.find(t => t.id === depId))
      .filter((t): t is TaskRecord => t !== undefined);
  }, [dependencies, allTasks]);

  const addDependency = (taskId: string) => {
    if (!dependencies.includes(taskId)) {
      onChange([...dependencies, taskId]);
      setSearchQuery("");
      setShowSuggestions(false);
    }
  };

  const removeDependency = (taskId: string) => {
    onChange(dependencies.filter(id => id !== taskId));
  };

  return (
    <div className="space-y-2">
      <Label>Dependencies</Label>
      <p className="text-xs text-foreground-muted">
        Tasks that must be completed before this one
      </p>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search for tasks to add as dependencies..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay hiding to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Suggestions dropdown */}
        {showSuggestions && searchQuery && filteredTasks.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {filteredTasks.slice(0, 10).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => addDependency(task.id)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-background-muted transition-colors"
              >
                <div className="font-medium">{task.title}</div>
                {task.description && (
                  <div className="text-xs text-foreground-muted truncate">
                    {task.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {showSuggestions && searchQuery && filteredTasks.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card p-3 text-sm text-foreground-muted shadow-lg">
            {availableTasks.length === 0
              ? "No available tasks. Create other tasks first to add dependencies."
              : "No tasks match your search."}
          </div>
        )}
      </div>

      {/* Selected dependencies */}
      {selectedTasks.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-foreground-muted">
            {selectedTasks.length} {selectedTasks.length === 1 ? "dependency" : "dependencies"}:
          </div>
          <div className="space-y-1">
            {selectedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background-muted px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{task.title}</div>
                  {task.description && (
                    <div className="text-xs text-foreground-muted truncate">
                      {task.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeDependency(task.id)}
                  className="ml-2 shrink-0 rounded p-1 hover:bg-background hover:text-foreground"
                  aria-label={`Remove ${task.title}`}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning for circular dependencies */}
      {taskId && selectedTasks.some(task =>
        wouldCreateCircularDependency(taskId, task.id, allTasks)
      ) && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            One or more dependencies would create a circular dependency. Please remove them.
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
