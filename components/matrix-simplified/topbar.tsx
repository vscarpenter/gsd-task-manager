"use client";

import type { RefObject } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { SyncStatusDisplay } from "@/components/app-header/sync-status-display";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  caption?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  rightSlot?: React.ReactNode;
}

export function SimplifiedTopbar({
  title,
  caption,
  searchQuery,
  onSearchChange,
  searchInputRef,
  rightSlot,
}: TopbarProps) {
  const syncStatus = useSyncStatus();
  const hasSearch = onSearchChange !== undefined;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b border-border/60",
        "bg-background/85 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-7"
      )}
    >
      <div className="min-w-0 flex-shrink-0">
        <h1
          className="rd-serif text-2xl leading-tight text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          {title}
        </h1>
        {caption ? (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground-muted">
            {caption}
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      {hasSearch ? (
        <div className="relative hidden w-72 sm:block">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            ref={searchInputRef}
            placeholder="Search tasks…"
            className="pl-9"
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks"
          />
        </div>
      ) : null}

      <div className="hidden sm:block">
        <SyncStatusDisplay {...syncStatus} />
      </div>

      {rightSlot}
    </header>
  );
}
