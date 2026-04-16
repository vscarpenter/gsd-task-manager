"use client";

import { RefObject, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquareIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SmartViewPills } from "@/components/smart-view-pills";
import { ViewToggle } from "@/components/view-toggle";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { SyncStatusDisplay } from "@/components/app-header/sync-status-display";
import { HeaderActions } from "@/components/app-header/header-actions";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
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
  const router = useRouter();
  const syncStatus = useSyncStatus();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const activeFilterCount = getActiveFilterCount(currentFilterCriteria);

  const openMobileSearch = () => {
    setSearchExpanded(true);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="md:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={searchExpanded ? "subtle" : "ghost"}
                      className="h-10 w-10 p-0"
                      onClick={() => {
                        if (searchExpanded) {
                          setSearchExpanded(false);
                          return;
                        }
                        openMobileSearch();
                      }}
                      aria-label={searchExpanded ? "Close search" : "Search tasks"}
                    >
                      {searchExpanded ? (
                        <XIcon className="h-4 w-4" />
                      ) : (
                        <SearchIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{searchExpanded ? "Close search" : "Search tasks (/)"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="hidden min-w-0 flex-1 md:flex">
                <div className="relative w-full max-w-[34rem]">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search tasks…"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    aria-label="Search tasks"
                  />
                </div>
              </div>

              <div className="min-w-0 md:hidden">
                <p className="truncate text-sm font-semibold text-foreground">
                  GSD Task Manager
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:flex">
                <SyncStatusDisplay {...syncStatus} />
              </div>

              <Button
                onClick={onNewTask}
                className={cn(
                  "hidden md:inline-flex",
                  isDoFirstEmpty && "animate-new-task-glow"
                )}
              >
                <PlusIcon className="h-4 w-4" />
                <span>New Task</span>
              </Button>

              <Button
                onClick={onNewTask}
                className={cn(
                  "md:hidden h-10 w-10 p-0",
                  isDoFirstEmpty && "animate-new-task-glow"
                )}
                aria-label="Create task"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>

              <div className="md:hidden">
                <HeaderActions
                  onHelp={onHelp}
                  onOpenSettings={onOpenSettings}
                  onOpenAbout={() => router.push(ROUTES.ABOUT)}
                  selectionMode={selectionMode}
                  onToggleSelectionMode={onToggleSelectionMode}
                  selectedCount={selectedCount}
                />
              </div>
            </div>
          </div>

          {searchExpanded && (
            <div className="border-t border-border/60 px-4 py-3 md:hidden sm:px-6">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <Input
                  ref={mobileSearchInputRef}
                  placeholder="Search tasks…"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  onBlur={() => {
                    if (!searchQuery) setSearchExpanded(false);
                  }}
                  aria-label="Search tasks"
                />
              </div>
            </div>
          )}

          <div className="border-t border-border/60 px-4 py-3 sm:px-6">
            <div className="md:hidden">
              <ViewToggle className="flex w-full" showLabelsOnMobile />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 pb-1 md:mt-0 md:gap-3 md:pb-0">
              <SmartViewPills
                onSelectView={onSelectSmartView}
                currentCriteria={currentFilterCriteria}
                activeViewId={activeSmartViewId}
                onActiveViewChange={onActiveViewChange}
              />
              <FilterButton
                onOpenFilters={onOpenFilters}
                activeFilterCount={activeFilterCount}
              />
              {onToggleSelectionMode && (
                <SelectionToggleButton
                  selectionMode={selectionMode}
                  selectedCount={selectedCount}
                  onToggleSelectionMode={onToggleSelectionMode}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function FilterButton({
  onOpenFilters,
  activeFilterCount,
}: {
  onOpenFilters: () => void;
  activeFilterCount: number;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={activeFilterCount > 0 ? "primary" : "subtle"} onClick={onOpenFilters}>
          <PlusIcon className="h-4 w-4 shrink-0" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                activeFilterCount > 0
                  ? "bg-white/20 text-white"
                  : "bg-background text-foreground"
              )}
            >
              {activeFilterCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Filter tasks by status, quadrant, tags, or due date</p>
      </TooltipContent>
    </Tooltip>
  );
}

function SelectionToggleButton({
  selectionMode,
  selectedCount,
  onToggleSelectionMode,
}: {
  selectionMode: boolean;
  selectedCount: number;
  onToggleSelectionMode: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={selectionMode ? "primary" : "subtle"}
          onClick={onToggleSelectionMode}
          className="shrink-0"
        >
          <CheckSquareIcon className="h-4 w-4" />
          <span>{selectionMode ? "Selecting" : "Select"}</span>
          {selectedCount > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                selectionMode
                  ? "bg-white/20 text-white"
                  : "bg-background text-foreground"
              )}
            >
              {selectedCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {selectionMode
            ? `Exit selection (${selectedCount} selected)`
            : "Select tasks"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function getActiveFilterCount(criteria?: FilterCriteria) {
  if (!criteria) return 0;

  let count = 0;
  if (criteria.status && criteria.status !== "all") count += 1;
  if (criteria.quadrants?.length) count += 1;
  if (criteria.tags?.length) count += 1;
  if (criteria.overdue) count += 1;
  if (criteria.dueToday) count += 1;
  if (criteria.dueThisWeek) count += 1;
  if (criteria.noDueDate) count += 1;
  if (criteria.dueDateRange) count += 1;
  if (criteria.recurrence?.length) count += 1;
  if (criteria.searchQuery) count += 1;
  return count;
}
