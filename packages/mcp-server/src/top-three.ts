/**
 * This package's copy of the top three rules (spec: tasks/spec-top-three.md, D-13) and
 * the escalation rule suggestions read (tasks/spec-escalation.md). The server keeps its
 * own copy, as it does the capture parser; web's lib/top-three.ts and lib/escalation.ts
 * are the originals, and the shared corpora pin all of them. Only what get_top_three
 * serves is here: today's picks and suggestions.
 */

export interface TopThreeTask {
  id: string;
  urgent: boolean;
  important: boolean;
  completed: boolean;
  savedAt?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  focusDate?: string;
  focusRank?: number;
}

export interface TodaysPicks {
  picks: string[];
  overflow: string[];
  needsTidy: boolean;
}

export interface EscalationResult {
  escalating: boolean;
  daysUntilDue: number | null;
  reason: 'overdue' | 'due-soon' | null;
  target: 'urgent-important' | 'urgent-not-important' | null;
}

export const MAX_PICKS = 3;
const MS_PER_DAY = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date in `timeZone`, as a UTC midnight so day differences are exact across DST. */
function calendarDayNumber(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / MS_PER_DAY;
}

/** Local calendar days from `now` to `dueDate` in `timeZone`; negative once past, null with no due date. */
export function daysUntilDue(dueDate: string | undefined, now: Date, timeZone: string): number | null {
  if (!dueDate) return null;
  return calendarDayNumber(new Date(dueDate), timeZone) - calendarDayNumber(now, timeZone);
}

/** `windowDays` is null when escalation is Off. */
export function evaluateEscalation(
  task: Pick<TopThreeTask, 'urgent' | 'important' | 'completed' | 'savedAt' | 'dueDate'>,
  now: Date,
  windowDays: number | null,
  timeZone: string
): EscalationResult {
  const days = daysUntilDue(task.dueDate, now, timeZone);
  const eligible =
    days !== null && windowDays !== null && !task.completed && !task.savedAt && !task.urgent;
  if (!eligible || days > windowDays) {
    return { escalating: false, daysUntilDue: days, reason: null, target: null };
  }
  return {
    escalating: true,
    daysUntilDue: days,
    reason: days < 0 ? 'overdue' : 'due-soon',
    target: task.important ? 'urgent-important' : 'urgent-not-important',
  };
}

/** The local calendar date of `now` in `zone`, as YYYY-MM-DD. */
export function localDate(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function isRealDate(date: string | undefined): boolean {
  const match = date ? DATE_PATTERN.exec(date) : null;
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

function isValidRank(rank: number | undefined): rank is number {
  return typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= MAX_PICKS;
}

function isEligible(task: TopThreeTask): boolean {
  return !task.completed && !task.savedAt;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lowest rank, then newest updatedAt, then id: the two-device conflict rule. */
function byConflictRule(a: TopThreeTask, b: TopThreeTask): number {
  return (a.focusRank ?? 0) - (b.focusRank ?? 0) || compareText(b.updatedAt, a.updatedAt) || compareText(a.id, b.id);
}

function pickedOn(tasks: TopThreeTask[], date: string): TopThreeTask[] {
  return tasks
    .filter((t) => isEligible(t) && t.focusDate === date && isRealDate(t.focusDate) && isValidRank(t.focusRank))
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

function byDueThenImportant(a: TopThreeTask, b: TopThreeTask): number {
  return (
    compareText(a.dueDate ?? '', b.dueDate ?? '') ||
    Number(b.important) - Number(a.important) ||
    compareText(a.id, b.id)
  );
}

function byCreated(a: TopThreeTask, b: TopThreeTask): number {
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

/** Suggested ids, in order: overdue Q1, escalating, Q1 with a due date, then the rest of Q1. */
export function suggestTopThree(
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
