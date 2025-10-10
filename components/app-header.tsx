"use client";

import { RefObject } from "react";
import { PlusIcon, SearchIcon, HelpCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GsdLogo } from "@/components/gsd-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsMenu } from "@/components/settings-menu";
import { SmartViewSelector } from "@/components/smart-view-selector";
import type { FilterCriteria } from "@/lib/filters";

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
  onOpenFilters // eslint-disable-line @typescript-eslint/no-unused-vars
}: AppHeaderProps) {

  return (
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
          <ThemeToggle />
          <Button className="h-10 w-10 p-0" onClick={onHelp} aria-label="Help">
            <HelpCircleIcon className="h-5 w-5" />
          </Button>
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
        <SmartViewSelector onSelectView={onSelectSmartView} />
        {/* Add Filter button temporarily disabled - Smart Views provide sufficient filtering */}
        {/* <Button variant="subtle" onClick={onOpenFilters}>
          <PlusIcon className="mr-2 h-4 w-4" /> Add Filter
        </Button> */}
      </div>
    </header>
  );
}
