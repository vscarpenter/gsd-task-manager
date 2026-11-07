import { toast } from "sonner";
import { addToToday } from "@/lib/tasks/top-three-actions";
import type { TaskRecord } from "@/lib/types";

const TOAST_MS = 2500;

/**
 * Add to today, and say what happened. A refused add (today is full) gets a plain
 * "Today is full" and counts as nothing done, so callers show no success after it.
 * Resolves true only when the pick was written.
 */
export async function addAndReport(id: string, tasks: TaskRecord[], now: Date, zone: string): Promise<boolean> {
  const result = await addToToday(id, tasks, now, zone);
  if (result === "full") toast.message("Today is full", { duration: TOAST_MS });
  return result === "added";
}
