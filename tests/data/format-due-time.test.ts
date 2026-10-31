import { afterEach, describe, expect, it } from "vitest";
import { formatDueDate } from "@/lib/utils";

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("formatDueDate with a time of day", () => {
  it("appends the time for a due date that has one", () => {
    process.env.TZ = "America/Chicago";
    expect(formatDueDate(new Date(2026, 3, 30, 15, 30).toISOString())).toMatch(/Apr 30, 2026, 3:30\s?PM$/);
  });

  it("leaves an all-day due date without a time", () => {
    process.env.TZ = "America/Chicago";
    expect(formatDueDate(new Date(2026, 3, 30).toISOString())).toMatch(/Apr 30, 2026$/);
  });
});
