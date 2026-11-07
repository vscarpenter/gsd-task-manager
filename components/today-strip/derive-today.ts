import { carryOver, nextRank, suggest, todaysPicks } from "@/lib/top-three";
import type { TaskRecord } from "@/lib/types";

const MAX_SUGGESTIONS = 3;
const MS_PER_DAY = 86_400_000;

export interface TodayView {
  picks: TaskRecord[];
  needsTidy: boolean;
  hasFreeSlot: boolean;
  carry: { label: string | null; tasks: TaskRecord[] };
  suggestions: TaskRecord[];
}

/** "From yesterday", or "From Friday" when the pick date is older. */
function carryLabel(fromDate: string, today: string): string {
  const days = (Date.parse(today) - Date.parse(fromDate)) / MS_PER_DAY;
  if (days === 1) return "From yesterday";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(fromDate)
  );
  return `From ${weekday}`;
}

function pick(byId: Map<string, TaskRecord>, ids: string[]): TaskRecord[] {
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Everything the Today strip shows, from the rules in lib/top-three.ts. Never writes. */
export function deriveToday(
  all: TaskRecord[],
  now: Date,
  windowDays: number | null,
  zone: string
): TodayView {
  const byId = new Map(all.map((t) => [t.id, t]));
  const { picks, needsTidy } = todaysPicks(all, now, zone);
  const hasFreeSlot = nextRank(all, now, zone) !== null;
  const offer = hasFreeSlot ? carryOver(all, now, zone) : { fromDate: null, ids: [] };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
  const carried = new Set(offer.ids);
  const suggestions = suggest(all, now, windowDays, zone)
    .filter((id) => !carried.has(id))
    .slice(0, MAX_SUGGESTIONS);
  return {
    picks: pick(byId, picks),
    needsTidy,
    hasFreeSlot,
    carry: {
      label: offer.fromDate ? carryLabel(offer.fromDate, today) : null,
      tasks: pick(byId, offer.ids),
    },
    suggestions: pick(byId, suggestions),
  };
}
