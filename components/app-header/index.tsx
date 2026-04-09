"use client";

import { RefObject, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GsdLogo } from "@/components/gsd-logo";
import { SmartViewPills } from "@/components/smart-view-pills";
import { ViewToggle } from "@/components/view-toggle";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { SyncStatusDisplay } from "@/components/app-header/sync-status-display";
import { HeaderActions } from "@/components/app-header/header-actions";
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
  activeSmartViewId?: string | null;
  onActiveViewChange?: (viewId: string | null) => void;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  selectedCount?: number;
  isDoFirstEmpty?: boolean;
}

export function AppHeader({
  onNewTask,
  onSearchChange,
  searchQuery,
  searchInputRef,
  onHelp,
  onOpenSettings,
  onSelectSmartView,
  onOpenFilters,
  currentFilterCriteria,
  activeSmartViewId,
  onActiveViewChange,
  selectionMode = false,
  onToggleSelectionMode,
  selectedCount = 0,
  isDoFirstEmpty = false,
}: AppHeaderProps) {
  const syncStatus = useSyncStatus();
  const [searchExpanded, setSearchExpanded] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 flex flex-col gap-2 border-b border-border/60 bg-background/70 px-4 py-3 sm:px-6 backdrop-blur-xl backdrop-saturate-150">
        {/* Row 1: Branding + Views | Status | Actions */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Branding + View tabs */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <GsdLogo className="shrink-0" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  GSD Task Manager
                </h1>
                <p className="hidden sm:block text-xs text-foreground-muted">
                  Prioritize what matters
                </p>
              </div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div className="hidden sm:block">
              <ViewToggle />
            </div>
          </div>

          {/* Right: Status + Action buttons */}
          <div className="flex items-center gap-3">
            <SyncStatusDisplay {...syncStatus} />

            <div className="h-6 w-px bg-border" />

            <HeaderActions
              onNewTask={onNewTask}
              onHelp={onHelp}
              onOpenSettings={onOpenSettings}
              selectionMode={selectionMode}
              onToggleSelectionMode={onToggleSelectionMode}
              selectedCount={selectedCount}
              isDoFirstEmpty={isDoFirstEmpty}
            />
          </div>
        </div>

        {/* Mobile view toggle -- only shown on small screens */}
        <div className="sm:hidden flex justify-center">
          <ViewToggle />
        </div>

        {/* Row 2: Search + Smart Views + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`relative ${searchExpanded ? "flex-1 opacity-100" : "max-w-0 overflow-hidden opacity-0 pointer-events-none"} transition-all duration-300 ease-out`}
          >
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
            <Input
              ref={searchInputRef}
              placeholder="Search tasks by title, description, tags, or subtasks"
              className="pl-9"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onBlur={() => {
                if (!searchQuery) setSearchExpanded(false);
              }}
              onFocus={() => setSearchExpanded(true)}
              aria-label="Search tasks"
            />
          </div>
          {!searchExpanded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="gap-2"
                  aria-label="Search tasks"
                >
                  <SearchIcon className="h-4 w-4" />
                  <span className="text-foreground-muted text-sm">Search</span>
                  <kbd className="ml-2 hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">
                    /
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search tasks (/) or open palette (&#8984;K)</p>
              </TooltipContent>
            </Tooltip>
          )}
          <SmartViewPills
            onSelectView={onSelectSmartView}
            currentCriteria={currentFilterCriteria}
            activeViewId={activeSmartViewId}
            onActiveViewChange={onActiveViewChange}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="subtle" onClick={onOpenFilters}>
                <PlusIcon className="mr-2 h-4 w-4" /> Add Filter
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filter tasks by status, quadrant, tags, or due date</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
