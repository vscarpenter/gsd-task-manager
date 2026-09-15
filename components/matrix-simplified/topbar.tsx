"use client";

import type { RefObject } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import { useScrollChrome } from "@/lib/use-scroll-chrome";
import { SyncStatusDisplay } from "@/components/matrix-simplified/sync-status-display";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  titleAsLabel?: boolean;
  caption?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  rightSlot?: React.ReactNode;
  /** Tuck the bar off the top edge on scroll-down at compact widths. */
  quietOnScroll?: boolean;
}

export function SimplifiedTopbar({
  title,
  titleAsLabel = false,
  caption,
  searchQuery,
  onSearchChange,
  searchInputRef,
  rightSlot,
  quietOnScroll = false,
}: TopbarProps) {
  const syncStatus = useSyncStatus();
  const hidden = useScrollChrome(quietOnScroll);
  const hasSearch = onSearchChange !== undefined;

  return (
    <header
      data-chrome-hidden={hidden ? "true" : undefined}
      className={topbarClassName(hidden)}
    >
      <div className="min-w-0 flex-shrink-0">
        {titleAsLabel ? (
          <p className="text-h3 font-semibold text-foreground">{title}</p>
        ) : (
          <h1 className="text-h3 font-semibold text-foreground">{title}</h1>
        )}
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
            data-testid="search-input"
            className="touch-target"
            ref={searchInputRef}
            placeholder="Search tasks…"
            style={{ paddingLeft: "2.25rem" }}
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

/**
 * The bar slides rather than collapses so the layout below never reflows. A
 * control that takes focus while tucked away pulls the bar back, so a keyboard
 * user on a phone never types into an off-screen field.
 */
function topbarClassName(hidden: boolean): string {
  return cn(
    "sticky top-0 z-20 flex items-center gap-3 border-b border-border/60",
    "bg-topbar px-4 py-3 sm:px-7",
    "transition-transform duration-200 ease-out",
    hidden && "max-md:-translate-y-full max-md:focus-within:translate-y-0"
  );
}
