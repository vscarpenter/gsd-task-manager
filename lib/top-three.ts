import { SYNC_CONFIG } from "@/lib/constants/sync";
import { daysUntilDue, evaluateEscalation } from "@/lib/escalation";
import type { TaskRecord } from "@/lib/types";

/**
 * Top three rules (spec: tasks/spec-top-three.md, decision D-13). Pure functions that
 * never change a task; iOS and Android implement the same rules against
 * tests/fixtures/cross-platform/top-three-corpus.json.
 *
 * Callers pass only rows from the active store. Archived and trashed rows live in
 * their own stores, so no selector reads them.
 */

export type TopThreeTask = Pick<
  TaskRecord,
  | "id"
  | "urgent"
  | "important"
  | "completed"
  | "savedAt"
  | "dueDate"
  | "createdAt"
  | "updatedAt"
  | "focusDate"
  | "focusRank"
>;

export interface TodaysPicks {
  picks: string[];
  overflow: string[];
  needsTidy: boolean;
}

export interface CarryOver {
  fromDate: string | null;
  ids: string[];
}

export interface FocusWrite {
  id: string;
  focusDate: string | null;
  focusRank: number | null;
}

export interface WireFocus {
  focus_date: string;
  focus_rank: number;
}

export const MAX_PICKS = 3;
const CARRY_OVER_DAYS = 7;
const MS_PER_DAY = 86_400_000;
/** First pull contract that reads each field; a stored version below it makes the field copyable. */
const FOCUS_FIRST_READ = SYNC_CONFIG.FOCUS_CONTRACT_VERSION;
const SAVED_FIRST_READ = SYNC_CONFIG.SAVED_AT_CONTRACT_VERSION;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The local calendar date of `now` in `zone`, as YYYY-MM-DD. */
function localDate(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Day count for a YYYY-MM-DD string, or null when it isn't a real calendar date. */
function dayNumber(date: string | null | undefined): number | null {
  const match = date ? DATE_PATTERN.exec(date) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  const real =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  return real ? ms / MS_PER_DAY : null;
}

function isValidRank(rank: number | null | undefined): rank is number {
  return typeof rank === "number" && Number.isInteger(rank) && rank >= 1 && rank <= MAX_PICKS;
}

function isEligible(task: TopThreeTask): boolean {
  return !task.completed && !task.savedAt;
}

/** A well-formed pair: a real date and a rank from 1 to 3. */
function hasPick(task: Pick<TopThreeTask, "focusDate" | "focusRank">): boolean {
  return dayNumber(task.focusDate) !== null && isValidRank(task.focusRank);
}

/** Lowest rank, then newest updatedAt, then id: the two-device conflict rule. */
function byConflictRule(a: TopThreeTask, b: TopThreeTask): number {
  return (
    (a.focusRank ?? 0) - (b.focusRank ?? 0) ||
    (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0) ||
    compareText(a.id, b.id)
  );
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pickedOn(tasks: TopThreeTask[], date: string): TopThreeTask[] {
  return tasks
    .filter((t) => isEligible(t) && t.focusDate === date && hasPick(t))
    .sort(byConflictRule);
}

export function todaysPicks(tasks: TopThreeTask[], now: Date, zone: string): TodaysPicks {
  const ordered = pickedOn(tasks, localDate(now, zone));
  const ranks = ordered.map((t) => t.focusRank);
  return {
    picks: ordered.slice(0, MAX_PICKS).map((t) => t.id),
    overflow: ordered.slice(MAX_PICKS).map((t) => t.id),
    needsTidy: ordered.length > MAX_PICKS || new Set(ranks).size < ranks.length,
  };
}

/** The lowest free rank from 1 to 3, or null when today is full. */
export function nextRank(tasks: TopThreeTask[], now: Date, zone: string): number | null {
  const used = new Set(pickedOn(tasks, localDate(now, zone)).map((t) => t.focusRank));
  for (let rank = 1; rank <= MAX_PICKS; rank++) {
    if (!used.has(rank)) return rank;
  }
  return null;
}

/**
 * Writes that give the first three picks ranks 1 to 3 and clear the overflow. Rows
 * already right aren't written, and a gap in ranks alone is no conflict, so it writes nothing.
 */
export function tidy(tasks: TopThreeTask[], now: Date, zone: string): FocusWrite[] {
  if (!todaysPicks(tasks, now, zone).needsTidy) return [];
  const date = localDate(now, zone);
  const writes: FocusWrite[] = [];
  pickedOn(tasks, date).forEach((task, index) => {
    if (index >= MAX_PICKS) {
      writes.push({ id: task.id, focusDate: null, focusRank: null });
    } else if (task.focusRank !== index + 1) {
      writes.push({ id: task.id, focusDate: date, focusRank: index + 1 });
    }
  });
  return writes;
}

function byDueThenImportant(a: TopThreeTask, b: TopThreeTask): number {
  return (
    compareText(a.dueDate ?? "", b.dueDate ?? "") ||
    Number(b.important) - Number(a.important) ||
    compareText(a.id, b.id)
  );
}

function byCreated(a: TopThreeTask, b: TopThreeTask): number {
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

/** Suggested ids, in order: overdue Q1, escalating, Q1 with a due date, then the rest of Q1. */
export function suggest(
  tasks: TopThreeTask[],
  now: Date,
  windowDays: number | null,
  zone: string
): string[] {
  const picked = new Set(pickedOn(tasks, localDate(now, zone)).map((t) => t.id));
  const overdue: TopThreeTask[] = [];
  const escalating: TopThreeTask[] = [];
  const dated: TopThreeTask[] = [];
  const undated: TopThreeTask[] = [];
  for (const task of tasks) {
    if (!isEligible(task) || picked.has(task.id)) continue;
    const days = daysUntilDue(task.dueDate, now, zone);
    if (task.urgent && task.important) {
      if (days === null) undated.push(task);
      else (days < 0 ? overdue : dated).push(task);
    } else if (evaluateEscalation(task, now, windowDays, zone).escalating) {
      escalating.push(task);
    }
  }
  return [
    ...overdue.sort(byDueThenImportant),
    ...escalating.sort(byDueThenImportant),
    ...dated.sort(byDueThenImportant),
    ...undated.sort(byCreated),
  ].map((t) => t.id);
}

/** The latest earlier pick date within seven local days, as an offer. Never a write. */
export function carryOver(tasks: TopThreeTask[], now: Date, zone: string): CarryOver {
  const today = dayNumber(localDate(now, zone))!;
  const earlier = tasks.filter((t) => {
    const day = dayNumber(t.focusDate);
    return isEligible(t) && hasPick(t) && day !== null && day < today && today - day <= CARRY_OVER_DAYS;
  });
  const fromDate = earlier.map((t) => t.focusDate!).sort().at(-1) ?? null;
  if (fromDate === null) return { fromDate: null, ids: [] };
  const ids = earlier
    .filter((t) => t.focusDate === fromDate)
    .sort(byConflictRule)
    .slice(0, MAX_PICKS)
    .map((t) => t.id);
  return { fromDate, ids };
}

/** Wire to client: an invalid pair becomes unset, both fields together. */
export function fromWire(wire: { focus_date?: string | null; focus_rank?: number | null }): {
  focusDate: string | null;
  focusRank: number | null;
} {
  const valid = dayNumber(wire.focus_date) !== null && isValidRank(wire.focus_rank);
  return valid
    ? { focusDate: wire.focus_date!, focusRank: wire.focus_rank! }
    : { focusDate: null, focusRank: null };
}

/** PocketBase never stores a null number, so unset is "" and 0 on the wire. */
export function toWire(task: { focusDate?: string | null; focusRank?: number | null }): WireFocus {
  return { focus_date: task.focusDate ?? "", focus_rank: task.focusRank ?? 0 };
}

/**
 * The focus keys a push sends. They come from the row as it is when the queue item
 * drains, never the queued payload. With no current row, both keys stay off the wire.
 */
export function pushFocus(
  current: { focusDate?: string | null; focusRank?: number | null } | null
): WireFocus | { omit: true } {
  return current === null ? { omit: true } : toWire(current);
}

export interface PullRow {
  updatedAt: string;
  focusDate: string | null;
  focusRank: number | null;
  savedAt: string | null;
}

export interface PullMergeInput {
  storedContract: number | null;
  tombstoned: boolean;
  local: PullRow | null;
  remote: PullRow;
}

export interface PullMergeResult {
  action: "insert" | "take-remote" | "copy-fields" | "none";
  conflict: boolean;
  row: PullRow | null;
}

/** A null stored version counts as below every version. */
function isBelow(storedContract: number | null, version: number): boolean {
  return storedContract === null || storedContract < version;
}

/** A locally newer row copies just the fields its build never read (spec section 6, C4-4). */
export function unreadFieldsToCopy(storedContract: number | null, local: PullRow, remote: PullRow): PullMergeResult {
  const copyFocus = isBelow(storedContract, FOCUS_FIRST_READ) && local.focusDate === null && remote.focusDate !== null;
  const copySaved =
    isBelow(storedContract, SAVED_FIRST_READ) && local.savedAt === null && remote.savedAt !== null;
  if (!copyFocus && !copySaved) return { action: "none", conflict: false, row: local };
  return {
    action: "copy-fields",
    conflict: false,
    row: {
      ...local,
      ...(copyFocus ? { focusDate: remote.focusDate, focusRank: remote.focusRank } : {}),
      ...(copySaved ? { savedAt: remote.savedAt } : {}),
    },
  };
}

/**
 * Decides one pulled record against its local row. Strictly newer wins, and the
 * same version takes the remote only while a backfill is due.
 */
export function pullMerge({ storedContract, tombstoned, local, remote }: PullMergeInput): PullMergeResult {
  if (local === null) {
    return tombstoned
      ? { action: "none", conflict: false, row: null }
      : { action: "insert", conflict: false, row: remote };
  }
  if (remote.updatedAt > local.updatedAt) {
    return { action: "take-remote", conflict: true, row: remote };
  }
  if (remote.updatedAt < local.updatedAt) return unreadFieldsToCopy(storedContract, local, remote);
  return isBelow(storedContract, FOCUS_FIRST_READ)
    ? { action: "take-remote", conflict: false, row: remote }
    : { action: "none", conflict: false, row: local };
}
