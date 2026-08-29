"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { runBackupExport } from "@/lib/backup-download";
import type { CommandActionHandlers } from "@/lib/command-actions";
import type { FilterCriteria } from "@/lib/filters";
import type { RedesignQuadrantKey } from "@/lib/quadrants";

/**
 * Window event dispatched by the command palette when the user picks
 * "Create new task". Matrix page subscribes and opens the create drawer.
 * Other routes fall back to a URL-driven flow (`/?action=new-task`).
 */
export const NEW_TASK_EVENT = "gsd:new-task";
export const HIGHLIGHT_TASK_EVENT = "gsd:highlight-task";
export const APPLY_SMART_VIEW_EVENT = "gsd:apply-smart-view";
export const FOCUS_CAPTURE_EVENT = "gsd:focus-capture";
export const FOCUS_QUADRANT_EVENT = "gsd:focus-quadrant";

/**
 * Window event dispatched by the command palette when the user picks
 * "Open user guide". The AppShell already subscribes via HelpDrawer.
 */
const OPEN_HELP_EVENT = "gsd:open-help";

export interface ApplySmartViewEventDetail {
  viewId: string;
  criteria?: FilterCriteria;
}

export interface FocusQuadrantEventDetail {
  quadrant: RedesignQuadrantKey;
}

export interface ShellShortcutHandlers {
  onCapture: () => void;
  onReview: () => void;
  onFocusQuadrant: (quadrant: RedesignQuadrantKey) => void;
}

interface ShellCommandResult {
  handlers: CommandActionHandlers;
  shortcutHandlers: ShellShortcutHandlers;
  onSelectTask: (taskId: string) => void;
  conditions: {
    isSyncEnabled: boolean;
  };
}

/**
 * Build the command-palette handlers + conditions for the v9 shell.
 *
 * Handlers are intentionally thin: navigation goes through next/router,
 * theme toggling uses next-themes, and matrix-specific actions dispatch
 * window CustomEvents that the matrix page subscribes to. This keeps the
 * shell decoupled from any one page's internal state.
 */
export function useShellCommandHandlers(): ShellCommandResult {
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const onSelectTask = (taskId: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/") {
      window.dispatchEvent(
        new CustomEvent(HIGHLIGHT_TASK_EVENT, { detail: { taskId } })
      );
    } else {
      router.push(`/?highlight=${encodeURIComponent(taskId)}`);
    }
  };

  const handlers: CommandActionHandlers = {
    onNewTask: () => {
      if (typeof window === "undefined") return;
      if (window.location.pathname === "/") {
        window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT));
      } else {
        router.push("/?action=new-task");
      }
    },
    onToggleTheme: () => {
      const current = theme === "system" ? resolvedTheme : theme;
      setTheme(current === "dark" ? "light" : "dark");
    },
    // The label says "Export tasks as JSON", so it exports. Navigating to
    // Settings — and to the Appearance tab at that — was not what it promised.
    onExportTasks: async () => {
      await runBackupExport();
    },
    // Import needs the merge/replace confirmation that lives on the Data
    // section, so this lands the user on that control rather than performing a
    // destructive write straight from the palette.
    onImportTasks: () => {
      router.push("/settings#data");
    },
    onOpenSettings: () => router.push("/settings"),
    onSendFeedback: () => router.push("/settings#feedback"),
    onOpenHelp: () => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT));
    },
    onViewDashboard: () => router.push("/dashboard"),
    onViewMatrix: () => router.push("/"),
    onViewArchive: () => router.push("/archive"),
    onApplySmartView: (criteria, viewId) => {
      if (typeof window === "undefined") return;
      if (window.location.pathname === "/") {
        window.dispatchEvent(
          new CustomEvent<ApplySmartViewEventDetail>(APPLY_SMART_VIEW_EVENT, {
            detail: { viewId, criteria },
          })
        );
      } else {
        router.push(`/?smartView=${encodeURIComponent(viewId)}`);
      }
    },
  };

  const shortcutHandlers: ShellShortcutHandlers = {
    onCapture: () => {
      if (typeof window === "undefined") return;
      if (window.location.pathname === "/") {
        window.dispatchEvent(new CustomEvent(FOCUS_CAPTURE_EVENT));
      } else {
        router.push("/?action=new-task");
      }
    },
    onReview: () => router.push("/dashboard"),
    onFocusQuadrant: (quadrant) => {
      if (typeof window === "undefined") return;
      if (window.location.pathname === "/") {
        window.dispatchEvent(
          new CustomEvent<FocusQuadrantEventDetail>(FOCUS_QUADRANT_EVENT, {
            detail: { quadrant },
          })
        );
      } else {
        router.push(`/?focusQuadrant=${quadrant}`);
      }
    },
  };

  return {
    handlers,
    shortcutHandlers,
    onSelectTask,
    conditions: {
      isSyncEnabled: false,
    },
  };
}
