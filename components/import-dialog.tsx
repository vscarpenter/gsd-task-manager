"use client";

import { useState } from "react";
import { AlertTriangleIcon, PlusCircleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importFromJson } from "@/lib/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("IMPORT");

/**
 * Determine the number of tasks an export payload will import.
 *
 * We only need the count for the dialog copy ("Importing 5 tasks") — the
 * real validation runs later in `importFromJson` via `importPayloadSchema`.
 * Tri-state result:
 *   number  — known count (valid array, or valid JSON without tasks key → 0)
 *   null    — couldn't determine (no contents, parse error, or `tasks` is the wrong type)
 * Avoids a misleading count for malformed payloads like `{ "tasks": "AAAA" }`
 * where a naive `parsed.tasks?.length ?? 0` would have reported `4`.
 */
function parseImportTaskCount(fileContents: string | null): number | null {
  if (!fileContents) return null;
  try {
    const parsed: unknown = JSON.parse(fileContents);
    if (parsed === null || typeof parsed !== "object") return null;
    const tasks = (parsed as { tasks?: unknown }).tasks;
    if (tasks === undefined) {
      // Valid JSON, no tasks key — definitively 0 tasks to import.
      return 0;
    }
    if (Array.isArray(tasks)) return tasks.length;
    // Malformed: tasks key present but not an array.
    return null;
  } catch {
    return null;
  }
}

interface ImportImpact {
  taskCount: number | null;
  /** Null when the file could not be read as a task list. */
  taskIds: Set<string> | null;
  hasArchive: boolean;
  archiveCount: number;
  hasTrash: boolean;
  trashCount: number;
}

const EMPTY_IMPACT: ImportImpact = {
  taskCount: null,
  taskIds: null,
  hasArchive: false,
  archiveCount: 0,
  hasTrash: false,
  trashCount: 0,
};

function idFromRow(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

/**
 * What a replace would do with this file. An absent archive or trash key
 * leaves that store alone. A present key replaces it.
 */
function parseImportImpact(fileContents: string | null): ImportImpact {
  if (!fileContents) return EMPTY_IMPACT;
  try {
    const parsed: unknown = JSON.parse(fileContents);
    if (parsed === null || typeof parsed !== "object") return EMPTY_IMPACT;
    const record = parsed as Record<string, unknown>;
    const tasks = record.tasks;
    let taskCount: number | null = null;
    let taskIds: Set<string> | null = null;
    if (tasks === undefined) {
      taskCount = 0;
      taskIds = new Set();
    } else if (Array.isArray(tasks)) {
      taskCount = tasks.length;
      taskIds = new Set(tasks.flatMap((row) => {
        const id = idFromRow(row);
        return id ? [id] : [];
      }));
    }
    const hasArchive = Object.prototype.hasOwnProperty.call(record, "archivedTasks");
    const hasTrash = Object.prototype.hasOwnProperty.call(record, "deletedTasks");
    return {
      taskCount,
      taskIds,
      hasArchive,
      archiveCount: Array.isArray(record.archivedTasks) ? record.archivedTasks.length : 0,
      hasTrash,
      trashCount: Array.isArray(record.deletedTasks) ? record.deletedTasks.length : 0,
    };
  } catch {
    return EMPTY_IMPACT;
  }
}

/** Live rows this device will lose. Null when the file's task list is unreadable. */
function liveDeleteCount(
  existingIds: readonly string[] | undefined,
  existingCount: number,
  fileIds: Set<string> | null,
): number | null {
  if (fileIds === null) return null;
  if (!existingIds) return existingCount;
  return existingIds.filter((id) => !fileIds.has(id)).length;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileContents: string | null;
  existingTaskCount: number;
  /** Ids of the live tasks, so the warning can count the ones the file does not keep. */
  existingTaskIds?: readonly string[];
  archivedCount?: number;
  trashedCount?: number;
  syncEnabled?: boolean;
  onImportComplete: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  fileContents,
  existingTaskCount,
  existingTaskIds,
  archivedCount = 0,
  trashedCount = 0,
  syncEnabled = false,
  onImportComplete,
}: ImportDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  // Derived during render — the count is a pure function of `fileContents`.
  // The React Compiler memoizes this, so no `useMemo` is needed.
  const importTaskCount = parseImportTaskCount(fileContents);
  const impact = parseImportImpact(fileContents);
  const liveDeletes = liveDeleteCount(existingTaskIds, existingTaskCount, impact.taskIds);
  const cloudDeletes = syncEnabled && liveDeletes !== 0;

  const handleImport = async (mode: "replace" | "merge") => {
    if (!fileContents) return;

    setIsImporting(true);
    // No `finally`: the React Compiler can't yet optimize a component with a
    // try/finally, so the importing reset is duplicated across both paths.
    try {
      await importFromJson(fileContents, mode);
      onImportComplete();
      onOpenChange(false);
      setIsImporting(false);
    } catch (error) {
      logger.error("Import failed", error instanceof Error ? error : new Error(String(error)));
      toast.error("Import failed. Ensure you selected a valid export file.");
      setIsImporting(false);
    }
  };

  const requestReplace = () => {
    if (cloudDeletes) {
      setConfirmingReplace(true);
      return;
    }
    void handleImport("replace");
  };

  const close = (next: boolean) => {
    if (!next) setConfirmingReplace(false);
    onOpenChange(next);
  };

  const liveDeleteLabel = liveDeletes === null
    ? "the tasks on this device that are not in this file"
    : `${liveDeletes} task${liveDeletes === 1 ? "" : "s"} on this device`;

  return (
    <Dialog open={open} onOpenChange={close}>
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
            type="button"
            onClick={() => handleImport("merge")}
            disabled={isImporting}
            className="w-full rounded-lg border-2 border-olive/30 bg-olive-tint p-4 text-left transition-all hover:border-olive/50 hover:bg-status-success-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-olive text-on-success">
                <PlusCircleIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Merge Tasks</h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  Keep your existing tasks and add the imported ones, archive included. Duplicate IDs are regenerated to avoid conflicts, and your settings stay as they are.
                </p>
                <p className="mt-2 text-xs font-medium text-olive-d">
                  ✓ Safe - No data loss
                </p>
              </div>
            </div>
          </button>

          {confirmingReplace ? (
            <div className="rounded-lg border-2 border-rust-tint-border bg-rust-tint p-4">
              <h3 className="font-semibold text-foreground">Delete these tasks from your account?</h3>
              <p className="mt-1 text-sm text-foreground-muted">
                Replace will delete {liveDeleteLabel} from this device and from your cloud account. Other devices drop them on the next sync. This cannot be undone.
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="subtle"
                  onClick={() => setConfirmingReplace(false)}
                  disabled={isImporting}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={() => void handleImport("replace")}
                  disabled={isImporting}
                  className="flex-1"
                >
                  Delete and replace
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestReplace}
              disabled={isImporting}
              className="w-full rounded-lg border-2 border-rust-tint-border bg-rust-tint p-4 text-left transition-all hover:border-rust/50 hover:bg-status-overdue-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-fill text-on-danger">
                  <RefreshCwIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Replace Everything</h3>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Restore this backup over the tasks on this device. This cannot be undone.
                  </p>
                  <p className="mt-2 text-sm text-foreground-muted">
                    {impact.hasArchive
                      ? `Replaces ${archivedCount} archived task${archivedCount === 1 ? "" : "s"} with ${impact.archiveCount} from this file.`
                      : "Leaves the archive on this device as it is."}
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {impact.hasTrash
                      ? `Replaces ${trashedCount} task${trashedCount === 1 ? "" : "s"} in Trash with ${impact.trashCount} from this file.`
                      : "Leaves Trash on this device as it is."}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-rust-d">
                    <AlertTriangleIcon className="h-3 w-3" />
                    <span>
                      {liveDeletes === null
                        ? "Warning. Deletes tasks on this device that are not in this file."
                        : `Warning. Deletes ${liveDeletes} task${liveDeletes === 1 ? "" : "s"} on this device.`}
                    </span>
                  </div>
                  {cloudDeletes ? (
                    <p className="mt-1 text-xs font-medium text-rust-d">
                      Sync is on, so those deletes also leave your cloud account.
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
          )}

          {/* Cancel button */}
          <Button
            variant="subtle"
            onClick={() => close(false)}
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
