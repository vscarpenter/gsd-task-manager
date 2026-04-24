"use client";

import { RefObject, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ViewToggle } from "@/components/view-toggle";
import { SyncStatusDisplay } from "@/components/app-header/sync-status-display";
import { HeaderActions } from "@/components/app-header/header-actions";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { ROUTES } from "@/lib/routes";

interface DashboardShellHeaderProps {
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onNewTask: () => void;
  onHelp: () => void;
  onOpenSettings: () => void;
}

export function DashboardShellHeader({
  searchQuery,
  searchInputRef,
  onSearchQueryChange,
  onSearchSubmit,
  onNewTask,
  onHelp,
  onOpenSettings,
}: DashboardShellHeaderProps) {
  const router = useRouter();
  const syncStatus = useSyncStatus();
  const [searchExpanded, setSearchExpanded] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const openMobileSearch = () => {
    setSearchExpanded(true);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="md:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={searchExpanded ? "subtle" : "ghost"}
                      className="h-11 w-11 p-0"
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

              <form
                className="hidden min-w-0 flex-1 md:flex"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSearchSubmit();
                }}
              >
                <div className="relative w-full max-w-[34rem]">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search tasks in Matrix…"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    aria-label="Search tasks"
                  />
                </div>
              </form>

              <div className="min-w-0 md:hidden">
                <p className="truncate text-sm font-semibold text-foreground">
                  Dashboard
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:flex">
                <SyncStatusDisplay {...syncStatus} />
              </div>

              <Button
                onClick={onNewTask}
                className="hidden md:inline-flex"
              >
                <PlusIcon className="h-4 w-4" />
                <span>New Task</span>
              </Button>

              <Button
                onClick={onNewTask}
                className="h-11 w-11 p-0 md:hidden"
                aria-label="Create task"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>

              <div className="md:hidden">
                <HeaderActions
                  onHelp={onHelp}
                  onOpenSettings={onOpenSettings}
                  onOpenAbout={() => router.push(ROUTES.ABOUT)}
                  selectionMode={false}
                  selectedCount={0}
                />
              </div>
            </div>
          </div>

          {searchExpanded && (
            <div className="border-t border-border/60 px-4 py-3 md:hidden sm:px-6">
              <form
                className="relative"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSearchSubmit();
                }}
              >
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <Input
                  ref={mobileSearchInputRef}
                  placeholder="Search tasks in Matrix…"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onBlur={() => {
                    if (!searchQuery) setSearchExpanded(false);
                  }}
                  aria-label="Search tasks"
                />
              </form>
            </div>
          )}

          <div className="border-t border-border/60 px-4 py-3 md:hidden sm:px-6">
            <ViewToggle className="flex w-full" showLabelsOnMobile />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
