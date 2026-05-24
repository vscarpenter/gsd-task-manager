"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { CommandActionHandlers } from "@/lib/command-actions";

/**
 * Window event dispatched by the command palette when the user picks
 * "Create new task". Matrix page subscribes and opens the create drawer.
 * Other routes fall back to a URL-driven flow (`/?action=new-task`).
 */
export const NEW_TASK_EVENT = "gsd:new-task";

/**
 * Window event dispatched by the command palette when the user picks
 * "Open user guide". The AppShell already subscribes via HelpDrawer.
 */
export const OPEN_HELP_EVENT = "gsd:open-help";

interface ShellCommandResult {
  handlers: CommandActionHandlers;
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

  return useMemo(() => {
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
      onApplySmartView: () => {
        // Smart-view actions are not surfaced in v9 (see ADR 0011); this
        // handler exists only to satisfy the CommandActionHandlers contract.
      },
    };

    return {
      handlers,
      conditions: {
        isSyncEnabled: false,
        selectionMode: false,
        hasSelection: false,
      },
    };
  }, [router, theme, resolvedTheme, setTheme]);
}
