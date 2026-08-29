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
  /** Whether closing the palette should return focus to its opener. */
  focusAfterExecute?: 'restore' | 'handoff';
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
  onSendFeedback: () => void;

  // Navigation
  onViewDashboard: () => void;
  onViewMatrix: () => void;
  onViewArchive: () => void;
  onViewSyncHistory?: () => void;

  // Smart views
  onApplySmartView: (criteria: FilterCriteria, viewId: string) => void;

  // Sync
  onTriggerSync?: () => Promise<void>;
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
  }
): CommandAction[] {
  // Import icon components dynamically
  const actions: CommandAction[] = [];

  // Core actions section
  actions.push(
    {
      id: 'new-task',
      label: 'Create new task',
      section: 'actions',
      keywords: ['new', 'create', 'add', 'task'],
      onExecute: handlers.onNewTask,
      focusAfterExecute: 'handoff'
    },
    {
      id: 'toggle-theme',
      label: 'Toggle theme',
      section: 'actions',
      keywords: ['dark', 'light', 'theme', 'appearance'],
      onExecute: handlers.onToggleTheme
    },
    {
      id: 'export-tasks',
      label: 'Export tasks as JSON',
      section: 'actions',
      keywords: ['export', 'download', 'backup', 'json'],
      onExecute: handlers.onExportTasks,
      focusAfterExecute: 'handoff'
    },
    {
      id: 'import-tasks',
      label: 'Import tasks from JSON',
      section: 'actions',
      keywords: ['import', 'upload', 'restore', 'json'],
      onExecute: handlers.onImportTasks,
      focusAfterExecute: 'handoff'
    }
  );

  // Navigation section
  actions.push(
    {
      id: 'view-matrix',
      label: 'View matrix',
      section: 'navigation',
      keywords: ['matrix', 'quadrants', 'eisenhower', 'home'],
      onExecute: handlers.onViewMatrix,
      focusAfterExecute: 'handoff'
    },
    {
      id: 'view-dashboard',
      label: 'View review',
      shortcut: ['⌥', 'R'],
      section: 'navigation',
      keywords: ['review', 'weekly', 'reflection', 'planning', 'dashboard', 'analytics', 'stats', 'metrics'],
      onExecute: handlers.onViewDashboard,
      focusAfterExecute: 'handoff'
    },
    {
      id: 'view-archive',
      label: 'View archived tasks',
      section: 'navigation',
      keywords: ['archive', 'completed', 'old', 'history'],
      onExecute: handlers.onViewArchive,
      focusAfterExecute: 'handoff'
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
      focusAfterExecute: 'handoff',
      condition: () => conditions.isSyncEnabled
    });
  }

  // Settings section
  actions.push(
    {
      id: 'open-settings',
      label: 'Open settings',
      section: 'settings',
      keywords: ['settings', 'preferences', 'config'],
      onExecute: handlers.onOpenSettings,
      focusAfterExecute: 'handoff'
    },
    {
      id: 'send-feedback',
      label: 'Send feedback',
      section: 'settings',
      keywords: ['feedback', 'suggest', 'roadmap', 'vote', 'idea', 'bug'],
      onExecute: handlers.onSendFeedback,
      focusAfterExecute: 'handoff'
    },
    {
      id: 'open-help',
      label: 'Open user guide',
      shortcut: ['?'],
      section: 'settings',
      keywords: ['help', 'guide', 'documentation', 'tutorial'],
      onExecute: handlers.onOpenHelp,
      focusAfterExecute: 'handoff'
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

  // Add smart view actions
  builtInSmartViews.forEach((view) => {
    actions.push({
      id: `view-${view.id}`,
      // Name only — a glyph concatenated here is read aloud by screen readers
      // and dilutes fuzzy-match scoring. Icons belong in the item's icon slot.
      label: view.name,
      section: 'views',
      keywords: [
        view.name.toLowerCase(),
        ...(view.description?.toLowerCase().split(' ') || []),
        'filter', 'view'
      ],
      onExecute: () => handlers.onApplySmartView(view.criteria, view.id),
      focusAfterExecute: 'handoff'
    });
  });

  return actions;
}
