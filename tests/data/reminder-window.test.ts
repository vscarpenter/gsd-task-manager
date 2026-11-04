import { afterEach, describe, expect, it } from "vitest";
import { isReminderDue, reminderFireAt, reminderWindow } from "@/lib/notifications/reminder-window";

// Vinny's rule (owner decision 6): an all-day task fires at 09:00 local on the
// due day, minus one day per whole day of offset. Timed tasks fire at due - offset.
const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

const local = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min);
const MINUTE = 60_000;

describe.each(["America/Chicago", "Asia/Tokyo", "Pacific/Auckland"])("in %s", (zone) => {
  it("fires an all-day task at 09:00 on the due day for a 15 minute offset", () => {
    process.env.TZ = zone;
    const { fire } = reminderWindow(local(2026, 9, 24).toISOString(), 15);
    expect(fire).toEqual(local(2026, 9, 24, 9));
  });

  it("fires an all-day task at 09:00 on the due day for an offset under a day", () => {
    process.env.TZ = zone;
    const { fire } = reminderWindow(local(2026, 9, 24).toISOString(), 1439);
    expect(fire).toEqual(local(2026, 9, 24, 9));
  });

  it("moves back one day per whole day of offset", () => {
    process.env.TZ = zone;
    expect(reminderWindow(local(2026, 9, 24).toISOString(), 1440).fire).toEqual(local(2026, 9, 23, 9));
    expect(reminderWindow(local(2026, 9, 24).toISOString(), 2880).fire).toEqual(local(2026, 9, 22, 9));
  });

  it("keeps a timed task at due minus the offset", () => {
    process.env.TZ = zone;
    const { fire } = reminderWindow(local(2026, 9, 24, 15, 30).toISOString(), 15);
    expect(fire).toEqual(local(2026, 9, 24, 15, 15));
  });
});

describe("expiry", () => {
  it("lets a timed reminder run to one hour after the due time", () => {
    process.env.TZ = "America/Chicago";
    const { expires } = reminderWindow(local(2026, 9, 24, 15, 30).toISOString(), 15);
    expect(expires).toEqual(local(2026, 9, 24, 16, 30));
  });

  it("measures a timed reminder deferred by quiet hours from the deferred fire time", () => {
    process.env.TZ = "America/Chicago";
    const quiet = { start: "22:00", end: "07:00" };
    const { fire, expires } = reminderWindow(local(2026, 9, 24, 2).toISOString(), 15, quiet);
    expect(fire).toEqual(local(2026, 9, 24, 7));
    expect(expires).toEqual(local(2026, 9, 24, 8));
  });

  it("leaves a timed reminder outside quiet hours expiring an hour after the due time", () => {
    process.env.TZ = "America/Chicago";
    const quiet = { start: "22:00", end: "07:00" };
    const { expires } = reminderWindow(local(2026, 9, 24, 15, 30).toISOString(), 15, quiet);
    expect(expires).toEqual(local(2026, 9, 24, 16, 30));
  });

  it("measures an all-day reminder's hour from its own fire time", () => {
    process.env.TZ = "America/Chicago";
    const { expires } = reminderWindow(local(2026, 9, 24).toISOString(), 15);
    expect(expires.getTime() - local(2026, 9, 24, 9).getTime()).toBe(60 * MINUTE);
  });
});

describe("across a DST change", () => {
  it("fires at 09:00 wall-clock on spring-forward day", () => {
    process.env.TZ = "America/Chicago"; // 2026-03-08
    expect(reminderWindow(local(2026, 3, 8).toISOString(), 15).fire).toEqual(local(2026, 3, 8, 9));
  });

  it("a one day offset across spring forward is still 09:00 the day before", () => {
    process.env.TZ = "America/Chicago";
    expect(reminderWindow(local(2026, 3, 9).toISOString(), 1440).fire).toEqual(local(2026, 3, 8, 9));
  });

  it("fires at 09:00 wall-clock on fall-back day", () => {
    process.env.TZ = "America/Chicago"; // 2026-11-01
    expect(reminderWindow(local(2026, 11, 1).toISOString(), 15).fire).toEqual(local(2026, 11, 1, 9));
  });
});

// Owner decision (2026-11-03): a snooze that ends before the reminder time doesn't
// fire, so it can't use up the reminder that comes at its own time.
describe("a snooze and the reminder time", () => {
  const due = local(2026, 11, 4, 10).toISOString(); // reminder at 09:45 with a 15 minute offset

  it("doesn't fire when a snooze ends before the reminder time", () => {
    const snoozedUntil = local(2026, 11, 3, 11).toISOString();
    expect(isReminderDue({ dueIso: due, notifyBefore: 15, now: local(2026, 11, 3, 11, 1), snoozedUntil })).toBe(false);
  });

  it("fires when a snooze ends after the reminder hour closed", () => {
    const snoozedUntil = local(2026, 11, 4, 12).toISOString();
    expect(isReminderDue({ dueIso: due, notifyBefore: 15, now: local(2026, 11, 4, 12, 1), snoozedUntil })).toBe(true);
  });

  it("plans the reminder time, not the end of a snooze that ends before it", () => {
    const snoozedUntil = local(2026, 11, 3, 11).toISOString();
    const fire = reminderFireAt({ dueIso: due, notifyBefore: 15, now: local(2026, 11, 3, 10), snoozedUntil });
    expect(fire).toEqual(local(2026, 11, 4, 9, 45));
  });

  it("plans the end of a snooze that ends after the reminder time", () => {
    const snoozedUntil = local(2026, 11, 4, 10, 30).toISOString();
    const fire = reminderFireAt({ dueIso: due, notifyBefore: 15, now: local(2026, 11, 4, 9, 50), snoozedUntil });
    expect(fire).toEqual(local(2026, 11, 4, 10, 30));
  });
});
