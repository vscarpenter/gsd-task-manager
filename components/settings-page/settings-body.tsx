"use client";

import { lazy, Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { exportToJsonWithReport } from "@/lib/tasks";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/types";

import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { FeatureSettings } from "@/components/settings/feature-settings";
import { NotificationSettingsSection } from "@/components/settings/notification-settings";
import { SyncSettings } from "@/components/settings/sync-settings";
import { ArchiveSettings } from "@/components/settings/archive-settings";
import { DataManagement } from "@/components/settings/data-management";
import { AboutSection } from "@/components/settings/about-section";

import { SectionCard } from "./section-card";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settings-sidebar-data";
import type { SettingsData } from "./use-settings-data";

const ImportDialog = lazy(() =>
  import("@/components/import-dialog").then((m) => ({ default: m.ImportDialog }))
);

const logger = createLogger("UI");
const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB

interface SettingsBodyProps {
  activeSection: SettingsSectionId;
  tasks: TaskRecord[];
  tasksLoading: boolean;
  settings: SettingsData;
}

/**
 * Renders the active settings section inside its SectionCard, and owns the
 * data-surface-local concerns (export, import file picker, import dialog,
 * task-count summary) that don't belong in the page shell.
 */
export function SettingsBody({
  activeSection,
  tasks,
  tasksLoading,
  settings,
}: SettingsBodyProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImportContents, setPendingImportContents] = useState<string | null>(null);

  const activeMeta =
    SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0];

  let activeTaskCount = 0;
  let completedTaskCount = 0;
  for (const task of tasks) {
    if (task.completed) completedTaskCount += 1;
    else activeTaskCount += 1;
  }
  const estimatedKb = (JSON.stringify(tasks).length / 1024).toFixed(1);

  // Returns whether the backup was actually written, so callers (e.g. the
  // delete-account dialog's export-first gate) can refuse to proceed when the
  // export failed.
  const handleExport = async (): Promise<boolean> => {
    setIsExporting(true);
    // No `finally`: the React Compiler can't yet optimize a component with a
    // try/finally, so the exporting reset is duplicated across both paths.
    try {
      const { json, skippedCount } = await exportToJsonWithReport();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gsd-tasks-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      if (skippedCount > 0) {
        // Never let a corrupt record silently vanish from the user's backup.
        toast.warning(
          `Exported, but ${skippedCount} unreadable task${skippedCount === 1 ? "" : "s"} could not be included.`,
        );
      } else {
        toast.success("Tasks exported");
      }
      setIsExporting(false);
      return true;
    } catch (error) {
      logger.error("Export failed", error instanceof Error ? error : undefined);
      toast.error("Failed to export tasks");
      setIsExporting(false);
      return false;
    }
  };

  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        toast.error(
          `Import file is too large (max 10 MB). Selected file: ${(file.size / 1024 / 1024).toFixed(1)} MB`,
        );
        return;
      }
      try {
        const contents = await file.text();
        JSON.parse(contents);
        setPendingImportContents(contents);
        setImportDialogOpen(true);
      } catch {
        toast.error("Invalid JSON format in import file");
      }
    };
    input.click();
  };

  return (
    <div className="min-w-0 flex-1">
      <SectionCard
        eyebrow={activeMeta.group}
        title={activeMeta.label}
        description={activeMeta.description}
        icon={activeMeta.icon}
      >
        {activeSection === "appearance" && (
          <AppearanceSettings
            showCompleted={settings.showCompleted}
            onToggleCompleted={settings.toggleCompleted}
          />
        )}
        {activeSection === "features" && settings.appPreferences && (
          <FeatureSettings
            smartViewsEnabled={settings.appPreferences.smartViewsEnabled}
            onToggleSmartViews={settings.toggleSmartViews}
          />
        )}
        {activeSection === "notifications" && (
          <NotificationSettingsSection
            settings={settings.notificationSettings}
            onNotificationToggle={settings.notificationToggle}
            onDefaultReminderChange={settings.defaultReminderChange}
          />
        )}
        {activeSection === "sync" && settings.syncEnabled && (
          <SyncSettings
            onViewHistory={() => router.push("/sync-history")}
            onExport={handleExport}
            onAccountDeleted={settings.markAccountDeleted}
          />
        )}
        {activeSection === "archive" && (
          <ArchiveSettings onViewArchive={() => router.push("/archive")} />
        )}
        {activeSection === "data" && (
          <DataManagement
            activeTasks={activeTaskCount}
            completedTasks={completedTaskCount}
            totalTasks={tasks.length}
            estimatedSize={estimatedKb}
            onExport={handleExport}
            onImportClick={handleImportClick}
            isLoading={isExporting || tasksLoading}
            syncEnabled={settings.syncEnabled}
            pendingSync={settings.pendingSync}
          />
        )}
        {activeSection === "about" && <AboutSection />}
      </SectionCard>

      {importDialogOpen && (
        <Suspense fallback={<div className="sr-only">Loading...</div>}>
          <ImportDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            fileContents={pendingImportContents}
            existingTaskCount={tasks.length}
            onImportComplete={() => {
              setImportDialogOpen(false);
              setPendingImportContents(null);
              toast.success("Tasks imported successfully");
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
