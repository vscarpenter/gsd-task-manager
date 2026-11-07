import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { notificationChecker } from "@/lib/notification-checker";
import * as notifications from "@/lib/notifications";
import { SWEEP_FIRED_KEY, SWEEP_REMINDER_KEY, writeSweepReminder } from "@/lib/preferences/weekly-sweep";
import { dueSweepOccurrence } from "@/lib/weekly-sweep";

const quiet = vi.hoisted(() => ({ on: false }));

vi.mock("@/lib/notifications", () => ({
  isNotificationSupported: vi.fn(() => true),
  checkNotificationPermission: vi.fn(() => "granted"),
  getNotificationSettings: vi.fn(async () => ({
    id: "settings", enabled: true, defaultReminder: 15, soundEnabled: true, permissionAsked: true, updatedAt: "2026-11-01T00:00:00.000Z",
  })),
  isInQuietHours: vi.fn(() => quiet.on),
  showTaskNotification: vi.fn(async () => true),
  showSweepReminder: vi.fn(async () => true),
  setAppBadge: vi.fn(async () => {}),
  clearAppBadge: vi.fn(async () => {}),
}));

const ZONE = "America/Chicago";

describe("dueSweepOccurrence", () => {
  const sunday9 = { enabled: true, weekday: 7, time: "09:00" };

  it("is the occurrence from the last 60 minutes", () => {
    const fire = dueSweepOccurrence(sunday9, new Date("2026-11-08T15:30:00.000Z"), ZONE); // 09:30 local

    expect(fire?.toISOString()).toBe("2026-11-08T15:00:00.000Z");
  });

  it("is null after the 60-minute window has passed", () => {
    expect(dueSweepOccurrence(sunday9, new Date("2026-11-08T16:01:00.000Z"), ZONE)).toBeNull();
  });

  it("is null before the occurrence and when the reminder is off", () => {
    expect(dueSweepOccurrence(sunday9, new Date("2026-11-08T14:59:00.000Z"), ZONE)).toBeNull();
    expect(dueSweepOccurrence({ ...sunday9, enabled: false }, new Date("2026-11-08T15:30:00.000Z"), ZONE)).toBeNull();
  });
});

describe("the weekly sweep reminder in the checker", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    quiet.on = false;
    localStorage.removeItem("gsd-reset-pending");
    localStorage.removeItem(SWEEP_FIRED_KEY);
    localStorage.removeItem(SWEEP_REMINDER_KEY);
    await getDb().tasks.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T10:30:00")); // Sunday, local
  });
  afterEach(() => {
    notificationChecker.stop();
    vi.useRealTimers();
  });

  it("fires inside the window", async () => {
    writeSweepReminder({ enabled: true, weekday: 7, time: "10:00" });

    await notificationChecker.checkAndNotify();

    expect(notifications.showSweepReminder).toHaveBeenCalledTimes(1);
  });

  it("fires once for an occurrence", async () => {
    writeSweepReminder({ enabled: true, weekday: 7, time: "10:00" });

    await notificationChecker.checkAndNotify();
    await notificationChecker.checkAndNotify();

    expect(notifications.showSweepReminder).toHaveBeenCalledTimes(1);
  });

  it("doesn't fire outside the window, or when off", async () => {
    writeSweepReminder({ enabled: true, weekday: 7, time: "08:00" });
    await notificationChecker.checkAndNotify();
    writeSweepReminder({ enabled: false, weekday: 7, time: "10:00" });
    await notificationChecker.checkAndNotify();

    expect(notifications.showSweepReminder).not.toHaveBeenCalled();
  });

  it("quiet hours don't defer it", async () => {
    quiet.on = true;
    writeSweepReminder({ enabled: true, weekday: 7, time: "10:00" });

    await notificationChecker.checkAndNotify();

    expect(notifications.showSweepReminder).toHaveBeenCalledTimes(1);
  });

  it("fires whether or not any task exists, so it can carry no count", async () => {
    writeSweepReminder({ enabled: true, weekday: 7, time: "10:00" });

    await notificationChecker.checkAndNotify();

    expect(notifications.showSweepReminder).toHaveBeenCalledWith();
  });
});
