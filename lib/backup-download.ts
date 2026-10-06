import { toast } from "sonner";

import { exportToJsonWithReport } from "@/lib/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("UI");

export interface BackupDownloadResult {
  ok: boolean;
  /** Records excluded from the file as unreadable. Never silently dropped. */
  skippedCount: number;
}

export const EXPORT_SUCCESS_MESSAGE = "Tasks exported";

/**
 * Warning text for a partial export, shared by the palette and Settings so the
 * two copies can't drift. "Records" because skipped rows can be tasks, archived
 * or trashed tasks, or smart views.
 */
export function skippedRecordsWarning(skippedCount: number): string {
  return `Exported, but ${skippedCount} unreadable record${skippedCount === 1 ? "" : "s"} could not be included.`;
}

/**
 * Write the backup to a file the user receives.
 *
 * Shared by Settings and the command palette so "Export tasks as JSON" performs
 * the same act from either surface — the palette entry previously only navigated
 * to Settings, which is not what the label promises.
 */
/**
 * Download the backup and report the outcome to the user.
 *
 * Callers that have no UI of their own (the command palette) get the same
 * feedback Settings gives, including the partial-export warning — a skipped
 * record must never vanish quietly from someone's only copy of their data.
 */
export async function runBackupExport(): Promise<boolean> {
  const { ok, skippedCount } = await downloadBackup();
  if (!ok) {
    toast.error("Failed to export tasks");
    return false;
  }
  if (skippedCount > 0) {
    toast.warning(skippedRecordsWarning(skippedCount));
    return true;
  }
  toast.success(EXPORT_SUCCESS_MESSAGE);
  return true;
}

export async function downloadBackup(): Promise<BackupDownloadResult> {
  try {
    const { json, skippedCount } = await exportToJsonWithReport();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gsd-tasks-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return { ok: true, skippedCount };
  } catch (error) {
    logger.error("Export failed", error instanceof Error ? error : undefined);
    return { ok: false, skippedCount: 0 };
  }
}
