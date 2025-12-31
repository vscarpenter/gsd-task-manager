"use client";

import { RefObject, useState, useEffect } from "react";
import { PlusIcon, SearchIcon, HelpCircleIcon, SettingsIcon, CheckSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GsdLogo } from "@/components/gsd-logo";
import { SmartViewPills } from "@/components/smart-view-pills";
import { ViewToggle } from "@/components/view-toggle";
import { SyncButton } from "@/components/sync/sync-button";
import { QuickSettingsPanel } from "@/components/quick-settings-panel";
import { useSync } from "@/lib/hooks/use-sync";
import { getSyncQueue } from "@/lib/sync/queue";
import type { FilterCriteria } from "@/lib/filters";

/**
 * Format timestamp to human-readable relative time
 */
function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

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
  selectedCount = 0
}: AppHeaderProps) {
  const { isEnabled, nextRetryAt, retryCount } = useSync();
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [, setTick] = useState(0); // Force re-render for relative time updates

  // Poll last sync time from coordinator
  useEffect(() => {
    const updateLastSync = async () => {
      if (!isEnabled) {
        setLastSyncTime(null);
        return;
      }

      const { getSyncCoordinator } = await import('@/lib/sync/sync-coordinator');
      const coordinator = getSyncCoordinator();
      const status = await coordinator.getStatus();
      setLastSyncTime(status.lastSyncAt);
    };

    updateLastSync();

    // Poll every 5 seconds
    const interval = setInterval(updateLastSync, 5000);
    return () => clearInterval(interval);
  }, [isEnabled]);

  // Force re-render every 30 seconds to update relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Poll pending operation count
  useEffect(() => {
    const updatePendingCount = async () => {
      if (!isEnabled) {
        setPendingCount(0);
        return;
      }
      
      const queue = getSyncQueue();
      const count = await queue.getPendingCount();
      setPendingCount(count);
    };

    updatePendingCount();

    // Poll every 2 seconds
    const interval = setInterval(updatePendingCount, 2000);
    return () => clearInterval(interval);
  }, [isEnabled]);

  // Update retry countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (nextRetryAt && nextRetryAt > Date.now()) {
        const secondsRemaining = Math.ceil((nextRetryAt - Date.now()) / 1000);
        setRetryCountdown(secondsRemaining);
      } else {
        setRetryCountdown(null);
      }
    };

    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

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
            
            {/* Sync status info */}
            <div className="flex items-center gap-2">
              <SyncButton />
              
              {/* Sync status text - only show when sync is enabled */}
              {isEnabled && (
                <div className="hidden lg:flex flex-col text-xs">
                  {/* Last sync time */}
                  <span className="text-foreground-muted">
                    Last sync: {formatRelativeTime(lastSyncTime)}
                  </span>
                  
                  {/* Pending operations or retry countdown */}
                  {retryCountdown !== null && retryCountdown > 0 ? (
                    <span className="text-orange-500 font-medium">
                      Retry in {retryCountdown}s (attempt {retryCount + 1})
                    </span>
                  ) : pendingCount > 0 ? (
                    <span className="text-blue-500 font-medium">
                      {pendingCount} pending operation{pendingCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-green-500">
                      All synced
                    </span>
                  )}
                </div>
              )}
            </div>
            
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
              <QuickSettingsPanel onOpenFullSettings={onOpenSettings}>
                <Button
                  variant="ghost"
                  className="h-12 w-12 p-0"
                  aria-label="Quick Settings"
                >
                  <SettingsIcon className="h-7 w-7" />
                </Button>
              </QuickSettingsPanel>
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
        <SmartViewPills
          onSelectView={onSelectSmartView}
          currentCriteria={currentFilterCriteria}
          activeViewId={activeSmartViewId}
          onActiveViewChange={onActiveViewChange}
        />
        <Button variant="subtle" onClick={onOpenFilters}>
          <PlusIcon className="mr-2 h-4 w-4" /> Add Filter
        </Button>
      </div>
      </header>
    </TooltipProvider>
  );
}
