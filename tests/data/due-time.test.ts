import { afterEach, describe, expect, it } from "vitest";
import { atTime, onDate, timeOf } from "@/lib/due-time";

// Ported from Android DueTimeTest.kt (D-1: local midnight means all day).
const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

const ZONES = ["America/Chicago", "Asia/Tokyo", "Pacific/Auckland"];

/** The ISO instant for a local wall-clock date and time in the current zone. */
function at(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

describe.each(ZONES)("due time in %s", (zone) => {
  const use = () => {
    process.env.TZ = zone;
  };

  it("treats a due date at local midnight as all day", () => {
    use();
    expect(timeOf(at("2026-09-24", "00:00"))).toBeUndefined();
  });

  it("reports the time of a due date that has one", () => {
    use();
    expect(timeOf(at("2026-09-24", "15:30"))).toBe("15:30");
  });

  it("keeps the time already set when the date changes", () => {
    use();
    expect(onDate(at("2026-09-24", "15:30"), "2026-09-30")).toBe(at("2026-09-30", "15:30"));
  });

  it("makes a task with no due date all day when a date is picked", () => {
    use();
    expect(onDate(undefined, "2026-09-30")).toBe(at("2026-09-30", "00:00"));
  });

  it("sets a time on the same local day", () => {
    use();
    expect(atTime(at("2026-09-24", "00:00"), "09:00")).toBe(at("2026-09-24", "09:00"));
  });

  it("makes the due date all day again when the time is cleared", () => {
    use();
    expect(atTime(at("2026-09-24", "15:30"), undefined)).toBe(at("2026-09-24", "00:00"));
  });
});

describe("across a DST change", () => {
  it("keeps a wall-clock time when the date moves over spring forward", () => {
    process.env.TZ = "America/Chicago";
    // US clocks jump on 2026-03-08; 15:30 stays 15:30 local.
    expect(timeOf(onDate(at("2026-03-07", "15:30"), "2026-03-09"))).toBe("15:30");
  });

  it("keeps all day all day over fall back", () => {
    process.env.TZ = "America/Chicago";
    expect(timeOf(onDate(undefined, "2026-11-01"))).toBeUndefined();
  });
});

describe("a stored instant viewed in another zone (D-1 known edge)", () => {
  it("shows an all-day task from another zone as a time", () => {
    process.env.TZ = "America/Chicago";
    const midnightChicago = at("2026-09-24", "00:00");
    process.env.TZ = "Asia/Tokyo";
    expect(timeOf(midnightChicago)).toBe("14:00");
  });
});
