"use client";

import { useState } from "react";
import { AlertTriangleIcon, PlusCircleIcon, RefreshCwIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importFromJson } from "@/lib/tasks";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileContents: string | null;
  existingTaskCount: number;
  onImportComplete: () => void;
}

export function ImportDialog({ open, onOpenChange, fileContents, existingTaskCount, onImportComplete }: ImportDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importTaskCount, setImportTaskCount] = useState<number | null>(null);

  // Parse the file to get task count when dialog opens
  useState(() => {
    if (fileContents) {
      try {
        const parsed = JSON.parse(fileContents);
        setImportTaskCount(parsed.tasks?.length ?? 0);
      } catch {
        setImportTaskCount(null);
      }
    }
  });

  const handleImport = async (mode: "replace" | "merge") => {
    if (!fileContents) return;

    setIsImporting(true);
    try {
      await importFromJson(fileContents, mode);
      onImportComplete();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      window.alert("Import failed. Ensure you selected a valid export file.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Tasks</DialogTitle>
          <DialogDescription>
            Choose how to import {importTaskCount ?? "these"} task{importTaskCount !== 1 ? "s" : ""} into your task manager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current state info */}
          <div className="rounded-lg border border-border bg-background-muted p-4">
            <p className="text-sm text-foreground-muted">
              You currently have <span className="font-semibold text-foreground">{existingTaskCount}</span> task{existingTaskCount !== 1 ? "s" : ""}.
            </p>
            {importTaskCount !== null && (
              <p className="mt-1 text-sm text-foreground-muted">
                Importing <span className="font-semibold text-foreground">{importTaskCount}</span> task{importTaskCount !== 1 ? "s" : ""}.
              </p>
            )}
          </div>

          {/* Merge option */}
          <button
            onClick={() => handleImport("merge")}
            disabled={isImporting}
            className="w-full rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:hover:border-emerald-700 dark:hover:bg-emerald-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <PlusCircleIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Merge Tasks</h3>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Keep your existing tasks and add the imported tasks. Duplicate IDs will be regenerated to avoid conflicts.
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ✓ Safe - No data loss
                </p>
              </div>
            </div>
          </button>

          {/* Replace option */}
          <button
            onClick={() => handleImport("replace")}
            disabled={isImporting}
            className="w-full rounded-lg border-2 border-red-200 bg-red-50 p-4 text-left transition-all hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:hover:border-red-700 dark:hover:bg-red-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
                <RefreshCwIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100">Replace All Tasks</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Delete all existing tasks and replace them with the imported tasks. This action cannot be undone.
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                  <AlertTriangleIcon className="h-3 w-3" />
                  <span>Warning - Deletes {existingTaskCount} existing task{existingTaskCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </button>

          {/* Cancel button */}
          <Button
            variant="subtle"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
