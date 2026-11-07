import { nextRank, tidy, todaysPicks } from "@/lib/top-three";
import { updateTask } from "@/lib/tasks";
import type { TaskRecord } from "@/lib/types";

/**
 * The only writes top three makes (spec: tasks/spec-top-three.md section 3.2).
 * Each is an ordinary edit through updateTask, so it bumps `updatedAt`, queues a
 * push, and touches no other field.
 */

/** The local calendar date of `now` in `zone`, as YYYY-MM-DD. */
function todayText(now: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function addToToday(
  id: string,
  tasks: TaskRecord[],
  now: Date,
  zone: string
): Promise<"added" | "full"> {
  const rank = nextRank(tasks, now, zone);
  if (rank === null) return "full";
  await updateTask(id, { focusDate: todayText(now, zone), focusRank: rank });
  return "added";
}

export async function removeFromToday(id: string): Promise<void> {
  await updateTask(id, { focusDate: undefined, focusRank: undefined });
}

/** Swap ranks with the neighbor in that direction. At either end it writes nothing. */
export async function movePick(
  id: string,
  direction: "up" | "down",
  tasks: TaskRecord[],
  now: Date,
  zone: string
): Promise<void> {
  const { picks } = todaysPicks(tasks, now, zone);
  const index = picks.indexOf(id);
  const neighborId = picks[index + (direction === "up" ? -1 : 1)];
  if (index < 0 || neighborId === undefined) return;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const date = todayText(now, zone);
  await updateTask(id, { focusDate: date, focusRank: byId.get(neighborId)!.focusRank });
  await updateTask(neighborId, { focusDate: date, focusRank: byId.get(id)!.focusRank });
}

/** Only when the user accepts the offer. Rows already correct aren't written. */
export async function tidyPicks(tasks: TaskRecord[], now: Date, zone: string): Promise<void> {
  for (const write of tidy(tasks, now, zone)) {
    await updateTask(write.id, {
      focusDate: write.focusDate ?? undefined,
      focusRank: write.focusRank ?? undefined,
    });
  }
}

/** A drag reorder: ranks 1 to 3 follow the new order, and rows already right aren't written. */
export async function reorderPicks(
  orderedIds: string[],
  tasks: TaskRecord[],
  now: Date,
  zone: string
): Promise<void> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const date = todayText(now, zone);
  for (const [index, id] of orderedIds.entries()) {
    if (byId.get(id)?.focusRank === index + 1) continue;
    await updateTask(id, { focusDate: date, focusRank: index + 1 });
  }
}
