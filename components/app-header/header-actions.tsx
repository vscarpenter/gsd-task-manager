"use client";

import {
  PlusIcon,
  HelpCircleIcon,
  SettingsIcon,
  CheckSquareIcon,
  InfoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderActionsProps {
  onNewTask: () => void;
  onHelp: () => void;
  onOpenSettings: () => void;
  selectionMode: boolean;
  onToggleSelectionMode?: () => void;
  selectedCount: number;
  isDoFirstEmpty: boolean;
}

export function HeaderActions({
  onNewTask,
  onHelp,
  onOpenSettings,
  selectionMode,
  onToggleSelectionMode,
  selectedCount,
  isDoFirstEmpty,
}: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {onToggleSelectionMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={selectionMode ? "primary" : "ghost"}
              className="h-12 w-12 p-0 hidden sm:flex xl:w-auto xl:px-3 xl:gap-2"
              onClick={onToggleSelectionMode}
              aria-label={
                selectionMode ? "Exit selection mode" : "Select tasks"
              }
            >
              <CheckSquareIcon className="h-7 w-7 xl:h-5 xl:w-5" />
              <span className="hidden xl:inline text-sm font-medium">
                Select
              </span>
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
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-12 w-12 p-0 xl:w-auto xl:px-3 xl:gap-2"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <SettingsIcon className="h-7 w-7 xl:h-5 xl:w-5" />
            <span className="hidden xl:inline text-sm font-medium">
              Settings
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Settings</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-12 w-12 p-0 xl:w-auto xl:px-3 xl:gap-2"
            onClick={onHelp}
            aria-label="User Guide"
          >
            <HelpCircleIcon className="h-7 w-7 xl:h-5 xl:w-5" />
            <span className="hidden xl:inline text-sm font-medium">
              Help
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>User Guide (?)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="/about"
            className="inline-flex items-center justify-center h-12 w-12 p-0 xl:w-auto xl:px-3 xl:gap-2 rounded-full text-foreground bg-transparent hover:bg-background-muted transition-all duration-200 active:scale-[0.97]"
            aria-label="About GSD"
          >
            <InfoIcon className="h-7 w-7 xl:h-5 xl:w-5" />
            <span className="hidden xl:inline text-sm font-medium">
              About
            </span>
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p>About GSD</p>
        </TooltipContent>
      </Tooltip>

      {/* Primary CTA -- filled style, visually distinct */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onNewTask}
            className={cn(
              "hidden sm:inline-flex",
              isDoFirstEmpty && "animate-new-task-glow"
            )}
          >
            <PlusIcon className="mr-2 h-4 w-4" /> New Task
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Create task (n)</p>
        </TooltipContent>
      </Tooltip>
      <Button
        onClick={onNewTask}
        className={cn(
          "sm:hidden",
          isDoFirstEmpty && "animate-new-task-glow"
        )}
        aria-label="Create task"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
