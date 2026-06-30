"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";

import { useTasks } from "@/lib/use-tasks";

import { SettingsSidebar } from "./settings-sidebar";
import { SettingsBody } from "./settings-body";
import { useSettingsData } from "./use-settings-data";
import { useActiveSection } from "./use-active-section";

export function SettingsPage() {
  const { all: tasks, isLoading: tasksLoading } = useTasks();
  const settings = useSettingsData();
  const { activeSection, visibleSectionIds, selectSection } = useActiveSection(
    settings.syncEnabled,
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mx-auto max-w-6xl pb-20">
        <div className="mb-8 sm:mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
            Preferences & Data
          </p>
          <h1 className="rd-serif mt-2 text-h1 text-foreground sm:text-display">
            Settings
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground-muted">
            Personalize the workspace, tune reminders, and manage local data without losing the calm, editorial tone of the main app.
          </p>
        </div>

        {!settings.dataLoaded ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <SettingsSidebar
              activeId={activeSection}
              onSelect={selectSection}
              visibleSections={visibleSectionIds}
            />
            <SettingsBody
              activeSection={activeSection}
              tasks={tasks}
              tasksLoading={tasksLoading}
              settings={settings}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
