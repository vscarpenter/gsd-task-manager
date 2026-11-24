"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { useTasks } from "@/lib/use-tasks";

import { SettingsSidebar } from "./settings-sidebar";
import { SettingsBody } from "./settings-body";
import { useSettingsData } from "./use-settings-data";
import { useActiveSection } from "./use-active-section";

export function SettingsPage() {
  const { stored: tasks, isLoading: tasksLoading } = useTasks();
  const settings = useSettingsData();
  const { activeSection, visibleSectionIds, selectSection } = useActiveSection(
    settings.syncEnabled,
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mx-auto max-w-6xl pb-20">
        <p className="mb-5 text-small text-foreground-muted">
          To sync across devices, open Sync from the top bar.
        </p>

        {settings.loadState === "loading" ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : settings.loadState === "error" ? (
          <div className="py-12 text-center">
            <p role="alert" className="text-foreground-muted">Could not load settings.</p>
            <Button variant="subtle" className="touch-target mt-4" onClick={settings.retryLoad}>Try again</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 lg:gap-8 lg:flex-row lg:items-start">
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
