"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { ViewToggle } from "@/components/view-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { GsdLogo } from "@/components/gsd-logo";
import { ROUTES } from "@/lib/routes";

import { useTasks } from "@/lib/use-tasks";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/types";
import { getSyncStatus } from "@/lib/sync/config";
import { exportToJson } from "@/lib/tasks";
import { createLogger } from "@/lib/logger";

import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { NotificationSettingsSection } from "@/components/settings/notification-settings";
import { SyncSettings } from "@/components/settings/sync-settings";
import { ArchiveSettings } from "@/components/settings/archive-settings";
import { DataManagement } from "@/components/settings/data-management";
import { AboutSection } from "@/components/settings/about-section";

import {
  SettingsSidebar,
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
} from "./settings-sidebar";
import { SectionCard } from "./section-card";

const ImportDialog = lazy(() =>
  import("@/components/import-dialog").then((m) => ({ default: m.ImportDialog }))
);

const SHOW_COMPLETED_KEY = "gsd:show-completed";
const DEFAULT_SECTION: SettingsSectionId = "appearance";
const logger = createLogger("UI");

export function SettingsPage() {
  const router = useRouter();
  const { all: tasks, isLoading: tasksLoading } = useTasks();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(DEFAULT_SECTION);
  const [showCompleted, setShowCompleted] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImportContents, setPendingImportContents] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = window.location.hash.slice(1) as SettingsSectionId;
    if (SETTINGS_SECTION_IDS.includes(initial)) {
      setActiveSection(initial);
    }
    const handler = () => {
      const next = window.location.hash.slice(1) as SettingsSectionId;
      if (SETTINGS_SECTION_IDS.includes(next)) setActiveSection(next);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [notif, sync] = await Promise.all([
          getNotificationSettings(),
          getSyncStatus(),
        ]);
        if (cancelled) return;
        setNotificationSettings(notif);
        setSyncEnabled(sync.enabled);
        setPendingSync(sync.pendingCount);
        setShowCompleted(
          typeof window !== "undefined" &&
            localStorage.getItem(SHOW_COMPLETED_KEY) === "true",
        );
        setDataLoaded(true);
      } catch (error) {
        logger.error(
          "Failed to load settings data",
          error instanceof Error ? error : undefined,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectSection = useCallback((id: SettingsSectionId) => {
    setActiveSection(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  const handleToggleCompleted = useCallback(() => {
    setShowCompleted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SHOW_COMPLETED_KEY, String(next));
        window.dispatchEvent(
          new CustomEvent("toggle-completed", { detail: { show: next } }),
        );
      }
      return next;
    });
  }, []);

  const reloadNotificationSettings = useCallback(async () => {
    const next = await getNotificationSettings();
    setNotificationSettings(next);
  }, []);

  const handleNotificationToggle = useCallback(async () => {
    if (!notificationSettings) return;
    const newEnabled = !notificationSettings.enabled;
    if (newEnabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    await updateNotificationSettings({ enabled: newEnabled });
    await reloadNotificationSettings();
  }, [notificationSettings, reloadNotificationSettings]);

  const handleDefaultReminderChange = useCallback(
    async (value: string) => {
      const minutes = Number.parseInt(value, 10);
      await updateNotificationSettings({ defaultReminder: minutes });
      await reloadNotificationSettings();
    },
    [reloadNotificationSettings],
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const json = await exportToJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gsd-tasks-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Tasks exported");
    } catch (error) {
      logger.error("Export failed", error instanceof Error ? error : undefined);
      toast.error("Failed to export tasks");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
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
  }, []);

  const handleViewArchive = useCallback(() => router.push("/archive"), [router]);
  const handleViewSyncHistory = useCallback(() => router.push("/sync-history"), [router]);

  const visibleSectionIds = useMemo<SettingsSectionId[]>(
    () =>
      SETTINGS_SECTIONS.filter((s) => s.id !== "sync" || syncEnabled).map(
        (s) => s.id,
      ),
    [syncEnabled],
  );

  useEffect(() => {
    if (!visibleSectionIds.includes(activeSection)) {
      setActiveSection(DEFAULT_SECTION);
    }
  }, [activeSection, visibleSectionIds]);

  const activeMeta =
    SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0];
  const activeTaskCount = tasks.filter((t) => !t.completed).length;
  const completedTaskCount = tasks.filter((t) => t.completed).length;
  const estimatedKb = (JSON.stringify(tasks).length / 1024).toFixed(1);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background-muted/30">
        <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href={ROUTES.HOME}
              className="flex items-center gap-3 rounded-full px-1 py-1 transition-colors hover:text-foreground"
              aria-label="Back to matrix"
            >
              <GsdLogo className="shrink-0" />
              <span className="hidden text-sm font-semibold text-foreground sm:inline">
                GSD Task Manager
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <ViewToggle />
              <div className="hidden h-6 w-px bg-border sm:block" />
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
          <div className="mb-8 sm:mb-12">
            <Link
              href={ROUTES.HOME}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Back to matrix
            </Link>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
              Preferences & Data
            </p>
            <h1 className="rd-serif mt-2 text-4xl tracking-tight text-foreground sm:text-5xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground-muted">
              Personalize the workspace, tune reminders, and manage local data without losing the calm, editorial tone of the main app.
            </p>
          </div>

          {!dataLoaded ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <SettingsSidebar
                activeId={activeSection}
                onSelect={handleSelectSection}
                visibleSections={visibleSectionIds}
              />
              <main className="min-w-0 flex-1">
                <SectionCard
                  eyebrow={activeMeta.group}
                  title={activeMeta.label}
                  description={activeMeta.description}
                  icon={activeMeta.icon}
                >
                  {activeSection === "appearance" && (
                    <AppearanceSettings
                      showCompleted={showCompleted}
                      onToggleCompleted={handleToggleCompleted}
                    />
                  )}
                  {activeSection === "notifications" && (
                    <NotificationSettingsSection
                      settings={notificationSettings}
                      onNotificationToggle={handleNotificationToggle}
                      onDefaultReminderChange={handleDefaultReminderChange}
                    />
                  )}
                  {activeSection === "sync" && syncEnabled && (
                    <SyncSettings onViewHistory={handleViewSyncHistory} />
                  )}
                  {activeSection === "archive" && (
                    <ArchiveSettings onViewArchive={handleViewArchive} />
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
                      syncEnabled={syncEnabled}
                      pendingSync={pendingSync}
                    />
                  )}
                  {activeSection === "about" && <AboutSection />}
                </SectionCard>
              </main>
            </div>
          )}
        </div>

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
    </TooltipProvider>
  );
}
