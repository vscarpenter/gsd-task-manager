"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { CommandActionHandlers } from "@/lib/command-actions";
import type { FilterCriteria } from "@/lib/filters";

/**
 * Window event dispatched by the command palette when the user picks
 * "Create new task". Matrix page subscribes and opens the create drawer.
 * Other routes fall back to a URL-driven flow (`/?action=new-task`).
 */
export const NEW_TASK_EVENT = "gsd:new-task";
export const HIGHLIGHT_TASK_EVENT = "gsd:highlight-task";
export const APPLY_SMART_VIEW_EVENT = "gsd:apply-smart-view";

/**
 * Window event dispatched by the command palette when the user picks
 * "Open user guide". The AppShell already subscribes via HelpDrawer.
 */
const OPEN_HELP_EVENT = "gsd:open-help";

export interface ApplySmartViewEventDetail {
  viewId: string;
  criteria?: FilterCriteria;
}

interface ShellCommandResult {
  handlers: CommandActionHandlers;
  onSelectTask: (taskId: string) => void;
  conditions: {
    isSyncEnabled: boolean;
    selectionMode: boolean;
    hasSelection: boolean;
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
    onExportTasks: async () => {
      router.push("/settings");
    },
    onImportTasks: () => {
      router.push("/settings");
    },
    onOpenSettings: () => router.push("/settings"),
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

  return {
    handlers,
    onSelectTask,
    conditions: {
      isSyncEnabled: false,
      selectionMode: false,
      hasSelection: false,
    },
  };
}
