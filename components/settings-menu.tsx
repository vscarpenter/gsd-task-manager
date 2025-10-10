"use client";

import { ChangeEvent, useRef, useState } from "react";
import { SettingsIcon, UploadIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SettingsMenuProps {
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export function SettingsMenu({ onExport, onImport, isLoading }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await onImport(file);
    event.target.value = "";
    setIsOpen(false);
  };

  const handleExport = async () => {
    await onExport();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="h-10 w-10 p-0"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Settings"
            aria-expanded={isOpen}
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Import / Export</p>
        </TooltipContent>
      </Tooltip>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-card-border bg-card shadow-lg">
            <div className="p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportChange}
                aria-hidden
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-muted disabled:opacity-50"
              >
                <UploadIcon className="h-4 w-4" />
                Import JSON
              </button>

              <button
                onClick={handleExport}
                disabled={isLoading}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-muted disabled:opacity-50"
              >
                <DownloadIcon className="h-4 w-4" />
                Export JSON
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
