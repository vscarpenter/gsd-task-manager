"use client";

import { Command } from "cmdk";
import { useCommandPalette } from "@/lib/use-command-palette";
import { buildCommandActions, type CommandActionHandlers } from "@/lib/command-actions";
import { getSmartViews } from "@/lib/smart-views";
import { useTasks } from "@/lib/use-tasks";
import { useState, useEffect } from "react";
import type { SmartView } from "@/lib/filters";
import { CommandGroup } from "./command-group";
import { TaskItem } from "./task-item";

interface CommandPaletteProps {
  handlers: CommandActionHandlers;
  conditions: {
    isSyncEnabled: boolean;
    selectionMode: boolean;
    hasSelection: boolean;
  };
}

/**
 * Command Palette - Universal search and action interface
 *
 * Opens with ⌘K / Ctrl+K
 * Provides quick access to actions, navigation, and task search
 */
export function CommandPalette({ handlers, conditions }: CommandPaletteProps) {
  const { all: tasks } = useTasks();
  const [smartViews, setSmartViews] = useState<SmartView[]>([]);

  // Load smart views
  useEffect(() => {
    const loadViews = async () => {
      const views = await getSmartViews();
      setSmartViews(views.filter((v) => v.isBuiltIn));
    };
    loadViews();
  }, []);

  // Build command actions
  const actions = buildCommandActions(handlers, smartViews, conditions);

  const {
    open,
    setOpen,
    search,
    setSearch,
    filteredActions,
    matchingTasks,
    executeAction,
    selectTask,
  } = useCommandPalette({ actions, tasks });

  // Group actions by section
  const actionsBySection = filteredActions.reduce(
    (acc, action) => {
      if (!acc[action.section]) {
        acc[action.section] = [];
      }
      acc[action.section].push(action);
      return acc;
    },
    {} as Record<string, typeof filteredActions>
  );

  return (
    <>
      {/* Visually hidden but accessible title and description */}
      <div className="sr-only">
        <h2 id="command-palette-title">Command Palette</h2>
        <p id="command-palette-description">
          Search for tasks, actions, and settings. Use arrow keys to navigate and Enter to select.
        </p>
      </div>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command Palette"
        className="fixed left-[50%] top-[20%] z-50 w-full max-w-[640px] translate-x-[-50%] overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:top-[20%] md:w-[640px]"
        contentClassName="max-h-[60vh] overflow-y-auto"
        aria-labelledby="command-palette-title"
        aria-describedby="command-palette-description"
      >
        <SearchInput search={search} onSearchChange={setSearch} />

        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-foreground-muted">
            No results found.
          </Command.Empty>

          {/* Tasks Section */}
          {matchingTasks.length > 0 && (
            <Command.Group
              heading="Tasks"
              className="px-2 py-1.5 text-xs font-semibold text-foreground-muted"
            >
              {matchingTasks.map((task) => (
                <TaskItem key={task.id} task={task} onSelect={() => selectTask(task.id)} />
              ))}
            </Command.Group>
          )}

          {/* Action Sections */}
          <CommandGroup
            heading="Actions"
            actions={actionsBySection.actions || []}
            onExecute={executeAction}
          />
          <CommandGroup
            heading="Navigation"
            actions={actionsBySection.navigation || []}
            onExecute={executeAction}
          />
          <CommandGroup
            heading="Smart Views"
            actions={actionsBySection.views || []}
            onExecute={executeAction}
          />
          <CommandGroup
            heading="Settings"
            actions={actionsBySection.settings || []}
            onExecute={executeAction}
          />
        </Command.List>

        <Footer isOpen={open} />
      </Command.Dialog>
    </>
  );
}

interface SearchInputProps {
  search: string;
  onSearchChange: (value: string) => void;
}

function SearchInput({ search, onSearchChange }: SearchInputProps) {
  return (
    <div className="flex items-center border-b border-border px-4">
      <svg
        className="mr-2 h-4 w-4 shrink-0 opacity-50"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <Command.Input
        value={search}
        onValueChange={onSearchChange}
        placeholder="Search tasks, actions, settings..."
        className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-50"
      />
      <kbd className="hidden sm:inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-foreground-muted ml-2">
        <span className="text-xs">ESC</span>
      </kbd>
    </div>
  );
}

interface FooterProps {
  isOpen: boolean;
}

function Footer({ isOpen }: FooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-foreground-muted">
      <div className="flex items-center gap-4">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
      </div>
      <span>⌘K to {isOpen ? "close" : "open"}</span>
    </div>
  );
}
