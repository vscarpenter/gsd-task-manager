import type { LucideIcon } from "lucide-react";
import type { FilterCriteria } from "@/lib/filters";

/**
 * Section types for grouping command actions
 */
export type CommandSection = 'actions' | 'navigation' | 'views' | 'settings';

/**
 * Command action interface
 */
export interface CommandAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string[]; // e.g., ['⌘', 'N'] or ['Ctrl', 'N']
  section: CommandSection;
  keywords: string[]; // For fuzzy search
  onExecute: () => void | Promise<void>;
  condition?: () => boolean; // Show/hide based on state
}

/**
 * Command action builder helpers
 */
export interface CommandActionHandlers {
  // Core actions
  onNewTask: () => void;
  onToggleTheme: () => void;
  onExportTasks: () => Promise<void>;
  onImportTasks: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;

  // Navigation
  onViewDashboard: () => void;
  onViewMatrix: () => void;
  onViewArchive: () => void;
  onViewSyncHistory?: () => void;

  // Smart views
  onApplySmartView: (criteria: FilterCriteria, viewId: string) => void;

  // Sync
  onTriggerSync?: () => Promise<void>;

  // Selection
  onToggleSelectionMode?: () => void;
  onClearSelection?: () => void;
}

/**
 * Build all command actions from handlers
 * This allows us to dynamically inject handlers from components
 */
export function buildCommandActions(
  handlers: CommandActionHandlers,
  builtInSmartViews: Array<{ id: string; name: string; icon?: string; criteria: FilterCriteria; description?: string }>,
  conditions: {
    isSyncEnabled: boolean;
    selectionMode: boolean;
    hasSelection: boolean;
  }
): CommandAction[] {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Import icon components dynamically
  const actions: CommandAction[] = [];

  // Core actions section
  actions.push(
    {
      id: 'new-task',
      label: 'Create new task',
      shortcut: [modKey, 'N'],
      section: 'actions',
      keywords: ['new', 'create', 'add', 'task'],
      onExecute: handlers.onNewTask
    },
    {
      id: 'toggle-theme',
      label: 'Toggle theme',
      shortcut: [modKey, 'T'],
      section: 'actions',
      keywords: ['dark', 'light', 'theme', 'appearance'],
      onExecute: handlers.onToggleTheme
    },
    {
      id: 'export-tasks',
      label: 'Export tasks as JSON',
      section: 'actions',
      keywords: ['export', 'download', 'backup', 'json'],
      onExecute: handlers.onExportTasks
    },
    {
      id: 'import-tasks',
      label: 'Import tasks from JSON',
      section: 'actions',
      keywords: ['import', 'upload', 'restore', 'json'],
      onExecute: handlers.onImportTasks
    }
  );

  // Navigation section
  actions.push(
    {
      id: 'view-matrix',
      label: 'View matrix',
      shortcut: [modKey, 'M'],
      section: 'navigation',
      keywords: ['matrix', 'quadrants', 'eisenhower', 'home'],
      onExecute: handlers.onViewMatrix
    },
    {
      id: 'view-dashboard',
      label: 'View dashboard',
      shortcut: [modKey, 'D'],
      section: 'navigation',
      keywords: ['dashboard', 'analytics', 'stats', 'metrics'],
      onExecute: handlers.onViewDashboard
    },
    {
      id: 'view-archive',
      label: 'View archived tasks',
      section: 'navigation',
      keywords: ['archive', 'completed', 'old', 'history'],
      onExecute: handlers.onViewArchive
    }
  );

  // Add sync history navigation if sync is enabled
  if (conditions.isSyncEnabled && handlers.onViewSyncHistory) {
    actions.push({
      id: 'view-sync-history',
      label: 'View sync history',
      section: 'navigation',
      keywords: ['sync', 'history', 'cloud', 'operations'],
      onExecute: handlers.onViewSyncHistory,
      condition: () => conditions.isSyncEnabled
    });
  }

  // Settings section
  actions.push(
    {
      id: 'open-settings',
      label: 'Open settings',
      shortcut: [modKey, ','],
      section: 'settings',
      keywords: ['settings', 'preferences', 'config'],
      onExecute: handlers.onOpenSettings
    },
    {
      id: 'open-help',
      label: 'Open user guide',
      shortcut: ['?'],
      section: 'settings',
      keywords: ['help', 'guide', 'documentation', 'tutorial'],
      onExecute: handlers.onOpenHelp
    }
  );

  // Add sync action if enabled
  if (conditions.isSyncEnabled && handlers.onTriggerSync) {
    actions.push({
      id: 'sync-now',
      label: 'Sync now',
      section: 'actions',
      keywords: ['sync', 'upload', 'download', 'cloud'],
      onExecute: handlers.onTriggerSync,
      condition: () => conditions.isSyncEnabled
    });
  }

  // Add selection mode actions if available
  if (handlers.onToggleSelectionMode) {
    actions.push({
      id: 'toggle-selection-mode',
      label: conditions.selectionMode ? 'Exit selection mode' : 'Enter selection mode',
      section: 'actions',
      keywords: ['select', 'selection', 'multiple', 'batch'],
      onExecute: handlers.onToggleSelectionMode
    });
  }

  if (handlers.onClearSelection && conditions.selectionMode && conditions.hasSelection) {
    actions.push({
      id: 'clear-selection',
      label: 'Clear selection',
      section: 'actions',
      keywords: ['clear', 'deselect', 'unselect'],
      onExecute: handlers.onClearSelection,
      condition: () => conditions.selectionMode && conditions.hasSelection
    });
  }

  // Add smart view actions
  builtInSmartViews.forEach((view) => {
    actions.push({
      id: `view-${view.id}`,
      label: `${view.icon || '📋'} ${view.name}`,
      section: 'views',
      keywords: [
        view.name.toLowerCase(),
        ...(view.description?.toLowerCase().split(' ') || []),
        'filter', 'view'
      ],
      onExecute: () => handlers.onApplySmartView(view.criteria, view.id)
    });
  });

  return actions;
}
