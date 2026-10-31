import { afterEach, describe, expect, it } from "vitest";
import corpus from "../fixtures/cross-platform/due-time-corpus.json";
import { localDayOf } from "@/lib/due-date-presets";
import { atTime, onDate, timeOf } from "@/lib/due-time";
import { reminderFireAt } from "@/lib/notifications/reminder-window";

// The shared D-1 corpus: every client runs every case (S-SPEC, SPEC-1).
interface Case {
  name: string;
  op: "classify" | "onDate" | "atTime" | "timedReminderFire" | "allDayReminderFire";
  zone: string;
  due: string | null;
  date?: string;
  time?: string | null;
  now?: string;
  notifyBefore?: number | null;
  defaultReminder?: number;
  snoozedUntil?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  expect: Record<string, unknown>;
}

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

function run(c: Case): unknown {
  switch (c.op) {
    case "classify": {
      const time = timeOf(c.due as string);
      return { allDay: time === undefined, localDate: localDayOf(c.due as string), displayTime: time ?? null };
    }
    case "onDate":
      return { due: onDate(c.due ?? undefined, c.date as string) };
    case "atTime":
      return { due: atTime(c.due as string, c.time ?? undefined) };
    default: {
      const fire = reminderFireAt({
        dueIso: c.due as string,
        notifyBefore: c.notifyBefore ?? c.defaultReminder ?? 0,
        now: new Date(c.now ?? 0),
        snoozedUntil: c.snoozedUntil ?? undefined,
        quietHoursStart: c.quietHoursStart ?? undefined,
        quietHoursEnd: c.quietHoursEnd ?? undefined,
      });
      return { fire: fire ? fire.toISOString() : null };
    }
  }
}

describe(`due-time corpus (${corpus.cases.length} cases)`, () => {
  it.each(corpus.cases as Case[])("$op: $name", (c) => {
    process.env.TZ = c.zone;
    expect(run(c)).toEqual(c.expect);
  });
});
