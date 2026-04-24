"use client";

import {
  CircleHelpIcon,
  EllipsisIcon,
  SettingsIcon,
  CheckSquareIcon,
  InfoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderActionsProps {
  onHelp: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  selectionMode: boolean;
  onToggleSelectionMode?: () => void;
  selectedCount: number;
}

export function HeaderActions({
  onHelp,
  onOpenSettings,
  onOpenAbout,
  selectionMode,
  onToggleSelectionMode,
  selectedCount,
}: HeaderActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 w-11 p-0"
          aria-label="More options"
        >
          <EllipsisIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        {onToggleSelectionMode && (
          <DropdownMenuItem onSelect={onToggleSelectionMode} className="gap-2">
            <CheckSquareIcon className="h-4 w-4" />
            <span>{selectionMode ? "Exit Selection" : "Select Tasks"}</span>
            {selectedCount > 0 && (
              <span className="ml-auto text-xs text-foreground-muted">
                {selectedCount}
              </span>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>App</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onOpenSettings} className="gap-2">
          <SettingsIcon className="h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onHelp} className="gap-2">
          <CircleHelpIcon className="h-4 w-4" />
          <span>Help</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenAbout} className="gap-2">
          <InfoIcon className="h-4 w-4" />
          <span>About</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
