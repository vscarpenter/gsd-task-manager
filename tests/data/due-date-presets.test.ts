import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resolveDuePreset, DUE_PRESETS } from "@/lib/due-date-presets";

describe("resolveDuePreset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for 'none'", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z"));
    expect(resolveDuePreset("none")).toBeUndefined();
  });

  it("returns today's ISO date for 'today'", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z"));
    expect(resolveDuePreset("today")).toBe("2026-04-26");
  });

  it("returns the upcoming Friday for 'this-week' on a Sunday", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z")); // Sunday
    expect(resolveDuePreset("this-week")).toBe("2026-05-01");
  });

  it("returns this Friday when called on a Wednesday", () => {
    vi.setSystemTime(new Date("2026-04-29T10:00:00Z")); // Wednesday
    expect(resolveDuePreset("this-week")).toBe("2026-05-01");
  });

  it("returns this Friday when called on Friday itself", () => {
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z")); // Friday
    expect(resolveDuePreset("this-week")).toBe("2026-05-01");
  });

  it("returns next Friday when called on a Saturday", () => {
    vi.setSystemTime(new Date("2026-05-02T10:00:00Z")); // Saturday
    expect(resolveDuePreset("this-week")).toBe("2026-05-08");
  });

  it("returns next Monday for 'next-week' from a Sunday", () => {
    vi.setSystemTime(new Date("2026-04-26T10:00:00Z")); // Sunday
    expect(resolveDuePreset("next-week")).toBe("2026-04-27");
  });

  it("returns the following Monday for 'next-week' from a Monday", () => {
    vi.setSystemTime(new Date("2026-04-27T10:00:00Z")); // Monday
    expect(resolveDuePreset("next-week")).toBe("2026-05-04");
  });

  it("exports preset list in display order", () => {
    expect(DUE_PRESETS).toEqual([
      { value: "none", label: "None" },
      { value: "today", label: "Today" },
      { value: "this-week", label: "This week" },
      { value: "next-week", label: "Next week" },
    ]);
  });
});
