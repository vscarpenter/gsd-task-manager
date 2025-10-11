"use client";

import { RefObject, useState, useEffect } from "react";
import { PlusIcon, SearchIcon, HelpCircleIcon, EyeIcon, EyeOffIcon, BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GsdLogo } from "@/components/gsd-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsMenu } from "@/components/settings-menu";
import { SmartViewSelector } from "@/components/smart-view-selector";
import type { FilterCriteria } from "@/lib/filters";
import { getDueSoonCount } from "@/lib/notification-checker";

interface AppHeaderProps {
  onNewTask: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onHelp: () => void;
  isLoading?: boolean;
  onSelectSmartView: (criteria: FilterCriteria) => void;
  onOpenFilters: () => void;
  currentFilterCriteria?: FilterCriteria;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onOpenNotifications: () => void;
}

export function AppHeader({
  onNewTask,
  onSearchChange,
  searchQuery,
  onExport,
  onImport,
  searchInputRef,
  onHelp,
  isLoading,
  onSelectSmartView,
  onOpenFilters, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentFilterCriteria,
  showCompleted,
  onToggleCompleted,
  onOpenNotifications
}: AppHeaderProps) {
  const [dueSoonCount, setDueSoonCount] = useState<number>(0);

  // Update due soon count periodically
  useEffect(() => {
    const updateCount = async () => {
      const count = await getDueSoonCount();
      setDueSoonCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GsdLogo className="shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent">GSD Task Manager</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Prioritize what matters
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SettingsMenu onExport={onExport} onImport={onImport} isLoading={isLoading} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showCompleted ? "primary" : "ghost"}
                  className="h-10 w-10 p-0"
                  onClick={onToggleCompleted}
                  aria-label={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
                  aria-pressed={showCompleted}
                >
                  {showCompleted ? <EyeIcon className="h-5 w-5" /> : <EyeOffIcon className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showCompleted ? "Hide" : "Show"} Completed Tasks</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 p-0"
                  onClick={onOpenNotifications}
                  aria-label="Notification settings"
                >
                  <BellIcon className="h-5 w-5" />
                  {dueSoonCount > 0 && (
                    <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                      {dueSoonCount > 9 ? "9+" : dueSoonCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {dueSoonCount > 0
                    ? `${dueSoonCount} task${dueSoonCount !== 1 ? "s" : ""} due soon`
                    : "Notification settings"}
                </p>
              </TooltipContent>
            </Tooltip>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="h-10 w-10 p-0" onClick={onHelp} aria-label="Help">
                  <HelpCircleIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help & Tips (Press ?)</p>
              </TooltipContent>
            </Tooltip>
            <Button onClick={onNewTask} className="hidden sm:inline-flex">
              <PlusIcon className="mr-2 h-4 w-4" /> New Task
            </Button>
            <Button onClick={onNewTask} className="sm:hidden" aria-label="Create task">
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            ref={searchInputRef}
            placeholder="Search tasks by title, description, tags, or subtasks"
            className="pl-9"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search tasks"
          />
        </div>
        <SmartViewSelector onSelectView={onSelectSmartView} currentCriteria={currentFilterCriteria} />
        {/* Add Filter button temporarily disabled - Smart Views provide sufficient filtering */}
        {/* <Button variant="subtle" onClick={onOpenFilters}>
          <PlusIcon className="mr-2 h-4 w-4" /> Add Filter
        </Button> */}
      </div>
      </header>
    </TooltipProvider>
  );
}
