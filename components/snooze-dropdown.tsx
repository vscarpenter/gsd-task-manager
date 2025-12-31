"use client";

import { useState } from "react";
import { BellOffIcon, ClockIcon, BellIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";
import { isTaskSnoozed, getRemainingSnoozeMinutes } from "@/lib/tasks";

interface SnoozeDropdownProps {
  task: TaskRecord;
  onSnooze: (taskId: string, minutes: number) => Promise<void>;
  className?: string;
}

/** Snooze duration options in minutes */
const SNOOZE_OPTIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "3 hours", minutes: 180 },
  { label: "Tomorrow", minutes: 24 * 60 },
  { label: "Next week", minutes: 7 * 24 * 60 },
] as const;

/** Format remaining snooze time for display */
function formatRemainingTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (24 * 60))}d`;
}

export function SnoozeDropdown({ task, onSnooze, className }: SnoozeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isSnoozed = isTaskSnoozed(task);
  const remainingMinutes = getRemainingSnoozeMinutes(task);

  const handleSnooze = async (minutes: number) => {
    await onSnooze(task.id, minutes);
    setIsOpen(false);
  };

  const handleClearSnooze = async () => {
    await onSnooze(task.id, 0);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded p-2 sm:px-1.5 sm:py-0.5 hover:bg-background-muted hover:text-foreground touch-manipulation",
            isSnoozed && "text-amber-500",
            className
          )}
          aria-label={isSnoozed ? `Snoozed for ${formatRemainingTime(remainingMinutes)}` : "Snooze notifications"}
        >
          {isSnoozed ? (
            <span className="flex items-center gap-1">
              <BellOffIcon className="h-4 w-4 sm:h-3 sm:w-3" />
              <span className="hidden sm:inline text-xs">{formatRemainingTime(remainingMinutes)}</span>
            </span>
          ) : (
            <BellIcon className="h-4 w-4 sm:h-3 sm:w-3" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-foreground-muted">
          <ClockIcon className="h-3 w-3" />
          Snooze notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SNOOZE_OPTIONS.map(({ label, minutes }) => (
          <DropdownMenuItem
            key={minutes}
            onClick={() => handleSnooze(minutes)}
            className="cursor-pointer"
          >
            {label}
          </DropdownMenuItem>
        ))}
        {isSnoozed && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleClearSnooze}
              className="cursor-pointer text-accent"
            >
              <BellIcon className="mr-2 h-3 w-3" />
              Clear snooze
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
