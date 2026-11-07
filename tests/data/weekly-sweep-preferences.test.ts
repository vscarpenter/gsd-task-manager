import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SWEEP_REMINDER,
  SWEEP_LAST_SWEPT_KEY,
  SWEEP_REMINDER_KEY,
  readLastSwept,
  readSweepReminder,
  resetWeeklySweepState,
  stampLastSwept,
  writeSweepReminder,
} from "@/lib/preferences/weekly-sweep";
import { wipeLocalData } from "@/lib/reset-local-data";

function clearStorage(): void {
  localStorage.removeItem(SWEEP_LAST_SWEPT_KEY);
  localStorage.removeItem(SWEEP_REMINDER_KEY);
}

describe("weekly sweep preferences", () => {
  beforeEach(clearStorage);

  it("starts with no sweep and the reminder off", () => {
    expect(readLastSwept()).toBeNull();
    expect(readSweepReminder()).toEqual({ ...DEFAULT_SWEEP_REMINDER, enabled: false });
  });

  it("turning the reminder on starts at Sunday 09:00", () => {
    expect(DEFAULT_SWEEP_REMINDER).toEqual({ enabled: true, weekday: 7, time: "09:00" });
  });

  it("round-trips last swept", () => {
    const at = new Date("2026-11-08T15:00:00.000Z");
    stampLastSwept(at);

    expect(readLastSwept()?.toISOString()).toBe(at.toISOString());
  });

  it("round-trips the reminder", () => {
    writeSweepReminder({ enabled: true, weekday: 1, time: "07:30" });

    expect(readSweepReminder()).toEqual({ enabled: true, weekday: 1, time: "07:30" });
  });

  it.each(["not json", '{"enabled":true,"weekday":9,"time":"09:00"}', '{"enabled":true,"weekday":7,"time":"25:99"}', "[]"])(
    "an unknown stored reminder (%s) falls back to off",
    (stored) => {
      localStorage.setItem(SWEEP_REMINDER_KEY, stored);

      expect(readSweepReminder().enabled).toBe(false);
    }
  );

  it("an unreadable last swept reads as never swept", () => {
    localStorage.setItem(SWEEP_LAST_SWEPT_KEY, "yesterday-ish");

    expect(readLastSwept()).toBeNull();
  });

  it("a reset clears both values", () => {
    stampLastSwept(new Date());
    writeSweepReminder({ enabled: true, weekday: 7, time: "09:00" });

    resetWeeklySweepState();

    expect(localStorage.getItem(SWEEP_LAST_SWEPT_KEY)).toBeNull();
    expect(localStorage.getItem(SWEEP_REMINDER_KEY)).toBeNull();
  });

  it("wiping local data clears both values", async () => {
    stampLastSwept(new Date());
    writeSweepReminder({ enabled: true, weekday: 7, time: "09:00" });

    await wipeLocalData();

    expect(readLastSwept()).toBeNull();
    expect(readSweepReminder().enabled).toBe(false);
  });
});
