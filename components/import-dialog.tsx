"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, PlusCircleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importFromJson } from "@/lib/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("IMPORT");

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

  // Parse the file to get task count when fileContents changes.
  //
  // We only need the count for the dialog copy ("Importing 5 tasks") — the
  // real validation runs later in `importFromJson` via `importPayloadSchema`.
  // Tri-state result:
  //   number  — known count (valid array, or valid JSON without tasks key → 0)
  //   null    — couldn't determine (parse error, or `tasks` is the wrong type)
  // Avoids a misleading count for malformed payloads like `{ "tasks": "AAAA" }`
  // where the old `parsed.tasks?.length ?? 0` would have reported `4`.
  useEffect(() => {
    if (!fileContents) {
      setImportTaskCount(null);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(fileContents);
      if (parsed === null || typeof parsed !== 'object') {
        setImportTaskCount(null);
        return;
      }
      const tasks = (parsed as { tasks?: unknown }).tasks;
      if (tasks === undefined) {
        // Valid JSON, no tasks key — definitively 0 tasks to import.
        setImportTaskCount(0);
      } else if (Array.isArray(tasks)) {
        setImportTaskCount(tasks.length);
      } else {
        // Malformed: tasks key present but not an array.
        setImportTaskCount(null);
      }
    } catch {
      setImportTaskCount(null);
    }
  }, [fileContents]);

  const handleImport = async (mode: "replace" | "merge") => {
    if (!fileContents) return;

    setIsImporting(true);
    try {
      await importFromJson(fileContents, mode);
      onImportComplete();
      onOpenChange(false);
    } catch (error) {
      logger.error("Import failed", error instanceof Error ? error : new Error(String(error)));
      toast.error("Import failed. Ensure you selected a valid export file.");
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
            className="w-full rounded-lg border-2 border-olive/30 bg-olive-tint p-4 text-left transition-all hover:border-olive/50 hover:bg-status-success-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-olive text-paper">
                <PlusCircleIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Merge Tasks</h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  Keep your existing tasks and add the imported tasks. Duplicate IDs will be regenerated to avoid conflicts.
                </p>
                <p className="mt-2 text-xs font-medium text-olive">
                  ✓ Safe - No data loss
                </p>
              </div>
            </div>
          </button>

          {/* Replace option */}
          <button
            onClick={() => handleImport("replace")}
            disabled={isImporting}
            className="w-full rounded-lg border-2 border-rust-tint-border bg-rust-tint p-4 text-left transition-all hover:border-rust/50 hover:bg-status-overdue-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rust text-paper">
                <RefreshCwIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Replace All Tasks</h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  Delete all existing tasks and replace them with the imported tasks. This action cannot be undone.
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-rust">
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
