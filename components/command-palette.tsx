"use client";

import { Command } from 'cmdk';
import {
  CheckIcon,
  PlusIcon,
  SettingsIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  ArchiveIcon,
  HistoryIcon,
  MoonIcon,
  SunIcon,
  DownloadIcon,
  UploadIcon,
  CloudIcon,
  SquareCheckIcon,
  XIcon
} from "lucide-react";
import { useCommandPalette } from "@/lib/use-command-palette";
import { buildCommandActions, type CommandActionHandlers } from "@/lib/command-actions";
import { getSmartViews } from "@/lib/smart-views";
import { useTasks } from "@/lib/use-tasks";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { SmartView } from "@/lib/filters";

// Map icon names to components
const iconMap = {
  plus: PlusIcon,
  settings: SettingsIcon,
  help: HelpCircleIcon,
  dashboard: LayoutDashboardIcon,
  matrix: LayoutGridIcon,
  archive: ArchiveIcon,
  history: HistoryIcon,
  moon: MoonIcon,
  sun: SunIcon,
  download: DownloadIcon,
  upload: UploadIcon,
  cloud: CloudIcon,
  check: SquareCheckIcon,
  x: XIcon
};

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
      setSmartViews(views.filter(v => v.isBuiltIn)); // Only built-in for now
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
    selectTask
  } = useCommandPalette({ actions, tasks });

  // Group actions by section
  const actionsBySection = filteredActions.reduce((acc, action) => {
    if (!acc[action.section]) {
      acc[action.section] = [];
    }
    acc[action.section].push(action);
    return acc;
  }, {} as Record<string, typeof filteredActions>);

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
          onValueChange={setSearch}
          placeholder="Search tasks, actions, settings..."
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-50"
        />
        <kbd className="hidden sm:inline-flex h-5 shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 text-[10px] font-medium text-foreground-muted ml-2">
          <span className="text-xs">ESC</span>
        </kbd>
      </div>

      <Command.List className="max-h-[400px] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-foreground-muted">
          No results found.
        </Command.Empty>

        {/* Tasks Section - Only show if there are matches */}
        {matchingTasks.length > 0 && (
          <Command.Group heading="Tasks" className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
            {matchingTasks.map((task) => (
              <Command.Item
                key={task.id}
                value={`task-${task.id}-${task.title}-${task.description}`}
                onSelect={() => selectTask(task.id)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
                  "hover:bg-accent/10 data-[selected]:bg-accent/10"
                )}
              >
                <CheckIcon className={cn(
                  "mr-2 h-4 w-4 shrink-0",
                  task.completed ? "text-green-500" : "text-foreground-muted/30"
                )} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-medium text-foreground truncate">{task.title}</div>
                  {task.description && (
                    <div className="text-xs text-foreground-muted truncate">{task.description}</div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      task.quadrant === "urgent-important" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                      task.quadrant === "not-urgent-important" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                      task.quadrant === "urgent-not-important" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      task.quadrant === "not-urgent-not-important" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    )}>
                      {task.quadrant.split('-').map(w => w[0].toUpperCase()).join('')}
                    </span>
                    {task.tags.length > 0 && (
                      <span className="text-foreground-muted">
                        {task.tags.slice(0, 2).map(tag => `#${tag}`).join(' ')}
                      </span>
                    )}
                  </div>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Actions Section */}
        {actionsBySection.actions && actionsBySection.actions.length > 0 && (
          <Command.Group heading="Actions" className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
            {actionsBySection.actions.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.keywords.join(' ')}`}
                onSelect={() => executeAction(action)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
                  "hover:bg-accent/10 data-[selected]:bg-accent/10"
                )}
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-foreground">{action.label}</span>
                </div>
                {action.shortcut && (
                  <div className="ml-auto flex items-center gap-1">
                    {action.shortcut.map((key, i) => (
                      <kbd key={i} className="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium text-foreground-muted">
                        {key}
                      </kbd>
                    ))}
                  </div>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Navigation Section */}
        {actionsBySection.navigation && actionsBySection.navigation.length > 0 && (
          <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
            {actionsBySection.navigation.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.keywords.join(' ')}`}
                onSelect={() => executeAction(action)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
                  "hover:bg-accent/10 data-[selected]:bg-accent/10"
                )}
              >
                <span className="text-foreground">{action.label}</span>
                {action.shortcut && (
                  <div className="ml-auto flex items-center gap-1">
                    {action.shortcut.map((key, i) => (
                      <kbd key={i} className="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium text-foreground-muted">
                        {key}
                      </kbd>
                    ))}
                  </div>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Smart Views Section */}
        {actionsBySection.views && actionsBySection.views.length > 0 && (
          <Command.Group heading="Smart Views" className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
            {actionsBySection.views.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.keywords.join(' ')}`}
                onSelect={() => executeAction(action)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
                  "hover:bg-accent/10 data-[selected]:bg-accent/10"
                )}
              >
                <span className="text-foreground">{action.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Settings Section */}
        {actionsBySection.settings && actionsBySection.settings.length > 0 && (
          <Command.Group heading="Settings" className="px-2 py-1.5 text-xs font-semibold text-foreground-muted">
            {actionsBySection.settings.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.keywords.join(' ')}`}
                onSelect={() => executeAction(action)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
                  "hover:bg-accent/10 data-[selected]:bg-accent/10"
                )}
              >
                <span className="text-foreground">{action.label}</span>
                {action.shortcut && (
                  <div className="ml-auto flex items-center gap-1">
                    {action.shortcut.map((key, i) => (
                      <kbd key={i} className="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium text-foreground-muted">
                        {key}
                      </kbd>
                    ))}
                  </div>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-foreground-muted">
        <div className="flex items-center gap-4">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
        </div>
        <span>⌘K to {open ? 'close' : 'open'}</span>
      </div>
    </Command.Dialog>
    </>
  );
}
