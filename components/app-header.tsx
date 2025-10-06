"use client";

import { ChangeEvent, RefObject, useRef } from "react";
import { PlusIcon, UploadIcon, DownloadIcon, SearchIcon, HelpCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GsdLogo } from "@/components/gsd-logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppHeaderProps {
  onNewTask: () => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onHelp: () => void;
  isLoading?: boolean;
}

export function AppHeader({ onNewTask, onSearchChange, searchQuery, onExport, onImport, searchInputRef, onHelp, isLoading }: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await onImport(file);
    event.target.value = "";
  };

  return (
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="subtle" className="h-10 w-10 p-0" onClick={onHelp} aria-label="Help">
            <HelpCircleIcon className="h-5 w-5" />
          </Button>
          <Button onClick={onNewTask} className="hidden sm:inline-flex">
            <PlusIcon className="mr-2 h-4 w-4" /> New Task
          </Button>
          <Button onClick={onNewTask} className="sm:hidden" aria-label="Create task">
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            ref={searchInputRef}
            placeholder="Search tasks by title, description, or quadrant"
            className="pl-9"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search tasks"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportChange}
          aria-hidden
        />
        <Button variant="subtle" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
          <UploadIcon className="mr-2 h-4 w-4" /> Import JSON
        </Button>
        <Button variant="subtle" onClick={onExport} disabled={isLoading}>
          <DownloadIcon className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>
    </header>
  );
}
