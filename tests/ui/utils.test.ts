import { describe, expect, it, vi } from "vitest";
import { formatRelative } from "@/lib/utils";

describe("formatRelative", () => {
  it("returns empty string when no value", () => {
    expect(formatRelative()).toBe("");
  });

  it("returns human friendly relative times within a week", () => {
    const now = new Date("2024-05-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatRelative("2024-05-03T00:00:00.000Z")).toContain("in");
    expect(formatRelative("2024-04-28T00:00:00.000Z")).toContain("ago");

    vi.useRealTimers();
  });

  it("falls back to calendar dates for distant events", () => {
    const result = formatRelative("2025-06-15T12:00:00.000Z");
    expect(result).toMatch(/Jun/);
  });
});
