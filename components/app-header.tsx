"use client";

import { RefObject } from "react";
import { PlusIcon, SearchIcon, HelpCircleIcon, SettingsIcon, CheckSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GsdLogo } from "@/components/gsd-logo";
import { SmartViewSelector } from "@/components/smart-view-selector";
import { ViewToggle } from "@/components/view-toggle";
import type { FilterCriteria } from "@/lib/filters";

interface AppHeaderProps {
  onNewTask: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onHelp: () => void;
  onOpenSettings: () => void;
  onSelectSmartView: (criteria: FilterCriteria) => void;
  onOpenFilters: () => void;
  currentFilterCriteria?: FilterCriteria;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  selectedCount?: number;
}

export function AppHeader({
  onNewTask,
  onSearchChange,
  searchQuery,
  searchInputRef,
  onHelp,
  onOpenSettings,
  onSelectSmartView,
  onOpenFilters, // eslint-disable-line @typescript-eslint/no-unused-vars
  currentFilterCriteria,
  selectionMode = false,
  onToggleSelectionMode,
  selectedCount = 0
}: AppHeaderProps) {

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
          <div className="flex items-center gap-3">
            <ViewToggle />
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              {onToggleSelectionMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={selectionMode ? "primary" : "ghost"}
                      className="h-12 w-12 p-0 hidden sm:flex"
                      onClick={onToggleSelectionMode}
                      aria-label={selectionMode ? "Exit selection mode" : "Select tasks"}
                    >
                      <CheckSquareIcon className="h-7 w-7" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{selectionMode ? `Exit selection (${selectedCount} selected)` : "Select tasks"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-12 w-12 p-0"
                    onClick={onOpenSettings}
                    aria-label="Settings"
                  >
                    <SettingsIcon className="h-7 w-7" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="h-12 w-12 p-0" onClick={onHelp} aria-label="User Guide">
                    <HelpCircleIcon className="h-7 w-7" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>User Guide (Press ?)</p>
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
