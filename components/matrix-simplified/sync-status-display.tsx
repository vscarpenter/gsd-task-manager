"use client";

import { ShieldCheckIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SyncButton } from "@/components/sync/sync-button";

interface SyncStatusDisplayProps {
  isEnabled: boolean;
  lastSyncTime: string | null;
  retryCountdown: number | null;
  retryCount: number;
  pendingCount: number;
  formatRelativeTime: (timestamp: string | null) => string;
}

export function SyncStatusDisplay({
  isEnabled,
  lastSyncTime,
  retryCountdown,
  retryCount,
  pendingCount,
  formatRelativeTime,
}: SyncStatusDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <SyncButton />
      {isEnabled ? (
        <div className="hidden lg:flex flex-col text-xs">
          <span className="text-foreground-muted">
            Last sync: {formatRelativeTime(lastSyncTime)}
          </span>
          {retryCountdown !== null && retryCountdown > 0 ? (
            <span className="text-orange-500 font-medium">
              Retry in {retryCountdown}s (attempt {retryCount + 1})
            </span>
          ) : pendingCount > 0 ? (
            <span className="text-blue-500 font-medium">
              {pendingCount} pending operation
              {pendingCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-green-500">All synced</span>
          )}
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-foreground-muted">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              <span>Saved locally</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              All data stored privately in your browser. Click the cloud icon
              to enable sync.
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
