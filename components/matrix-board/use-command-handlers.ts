import { useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useErrorHandlerWithUndo } from "@/lib/use-error-handler";
import { TOAST_DURATION } from "@/lib/constants";
import { exportTasks } from "@/lib/tasks";
import { useSync } from "@/lib/hooks/use-sync";
import { ROUTES } from "@/lib/routes";
import type { CommandActionHandlers } from "@/lib/command-actions";
import type { FilterCriteria } from "@/lib/filters";

interface UseCommandHandlersOptions {
  openCreateDialog: () => void;
  openHelpDialog: () => void;
  openImportDialog: (contents: string) => void;
  selectionMode: boolean;
  hasSelection: boolean;
  onToggleSelectionMode: () => void;
  onClearSelection: () => void;
  onSelectSmartView: (criteria: FilterCriteria) => void;
  onSetActiveSmartViewId: (id: string) => void;
}

export function useCommandHandlers(options: UseCommandHandlersOptions): {
  commandHandlers: CommandActionHandlers;
  isSyncEnabled: boolean;
  handleImport: (file: File) => Promise<void>;
  handleImportComplete: () => void;
} {
  const {
    openCreateDialog,
    openHelpDialog,
    openImportDialog,
    onSelectSmartView,
    onSetActiveSmartViewId,
    onToggleSelectionMode,
    onClearSelection,
  } = options;
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const { handleError } = useErrorHandlerWithUndo();
  const { isEnabled: isSyncEnabled } = useSync();

  const handleImport = useCallback(async (file: File) => {
    try {
      const contents = await file.text();
      JSON.parse(contents);
      openImportDialog(contents);
    } catch (error) {
      handleError(error, {
        action: "PARSE_JSON",
        userMessage: "Invalid JSON format in import file",
        timestamp: new Date().toISOString(),
        metadata: { fileName: file.name }
      });
    }
  }, [openImportDialog, handleError]);

  const handleImportComplete = useCallback(() => {
    showToast("Tasks imported successfully", undefined, TOAST_DURATION.SHORT);
  }, [showToast]);

  const commandHandlers: CommandActionHandlers = useMemo(() => ({
    onNewTask: openCreateDialog,
    onToggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    onExportTasks: async () => {
      await exportTasks();
      showToast("Tasks exported successfully", undefined, TOAST_DURATION.SHORT);
    },
    onImportTasks: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) await handleImport(file);
      };
      input.click();
    },
    onOpenSettings: () => router.push(ROUTES.SETTINGS),
    onOpenHelp: openHelpDialog,
    onViewDashboard: () => router.push("/dashboard"),
    onViewMatrix: () => router.push("/"),
    onViewArchive: () => router.push("/archive"),
    onViewSyncHistory: isSyncEnabled ? () => router.push("/sync-history") : undefined,
    onApplySmartView: (criteria, viewId) => {
      onSelectSmartView(criteria);
      onSetActiveSmartViewId(viewId);
    },
    onTriggerSync: isSyncEnabled ? async () => {
      const { getSyncCoordinator } = await import("@/lib/sync/sync-coordinator");
      const coordinator = getSyncCoordinator();
      await coordinator.requestSync("user");
      showToast("Sync triggered", undefined, TOAST_DURATION.SHORT);
    } : undefined,
    onToggleSelectionMode,
    onClearSelection
  }), [
    openCreateDialog, openHelpDialog,
    onSelectSmartView, onSetActiveSmartViewId,
    onToggleSelectionMode, onClearSelection,
    setTheme, theme, showToast, handleImport, router, isSyncEnabled
  ]);

  return { commandHandlers, isSyncEnabled, handleImport, handleImportComplete };
}
