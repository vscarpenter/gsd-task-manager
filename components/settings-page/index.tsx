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
          <p className="text-eyebrow uppercase text-foreground-muted">
            Preferences & Data
          </p>
          <h2 className="mt-2 text-h1 font-semibold tracking-tight text-foreground sm:text-display">
            Settings
          </h2>
          <p className="mt-3 max-w-[55ch] text-base leading-relaxed text-foreground-muted">
            Change how GSD looks and when it reminds you. Sync your tasks, back them up, or bring back ones you deleted.
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
