import { describe, it, expect } from "vitest";
import {
  cn,
  isoNow,
  formatDueDate,
  formatRelative,
  isOverdue,
  isDueToday,
  isDueThisWeek,
} from "@/lib/utils";

describe("utils", () => {
  describe("cn", () => {
    it("combines class names", () => {
      const result = cn("foo", "bar");
      expect(result).toBe("foo bar");
    });

    it("filters out falsy values", () => {
      const result = cn("foo", false, "bar", null, undefined, "baz");
      expect(result).toBe("foo bar baz");
    });

    it("handles empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });
  });

  describe("isoNow", () => {
    it("returns ISO 8601 timestamp", () => {
      const result = isoNow();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("returns current time", () => {
      const before = Date.now();
      const result = new Date(isoNow()).getTime();
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe("formatDueDate", () => {
    it("formats date with day of week and date", () => {
      const result = formatDueDate("2024-12-25T12:00:00.000Z");
      expect(result).toContain("Dec");
      expect(result).toMatch(/2[45]/); // Could be 24 or 25 depending on timezone
      expect(result).toContain("2024");
    });

    it("returns 'No due date' for undefined", () => {
      const result = formatDueDate(undefined);
      expect(result).toBe("No due date");
    });

    it("returns 'No due date' for empty string", () => {
      const result = formatDueDate("");
      expect(result).toBe("No due date");
    });
  });

  describe("formatRelative", () => {
    it("returns empty string for undefined", () => {
      const result = formatRelative(undefined);
      expect(result).toBe("");
    });

    it("returns empty string for empty string", () => {
      const result = formatRelative("");
      expect(result).toBe("");
    });

    it("returns relative format for dates within 6 days", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = formatRelative(tomorrow.toISOString());

      expect(result.toLowerCase()).toContain("tomorrow");
    });

    it("returns full date for dates beyond 6 days", () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const result = formatRelative(future.toISOString());

      // Should return full date format (contains month name, not relative "day")
      expect(result).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });
  });

  describe("isOverdue", () => {
    it("returns false for undefined", () => {
      expect(isOverdue(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isOverdue("")).toBe(false);
    });

    it("returns true for past dates", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isOverdue(yesterday.toISOString())).toBe(true);
    });

    it("returns false for future dates", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isOverdue(tomorrow.toISOString())).toBe(false);
    });

    it("returns false for today", () => {
      const today = new Date();
      expect(isOverdue(today.toISOString())).toBe(false);
    });
  });

  describe("isDueToday", () => {
    it("returns false for undefined", () => {
      expect(isDueToday(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isDueToday("")).toBe(false);
    });

    it("returns true for today's date", () => {
      const today = new Date();
      expect(isDueToday(today.toISOString())).toBe(true);
    });

    it("returns false for yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isDueToday(yesterday.toISOString())).toBe(false);
    });

    it("returns false for tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isDueToday(tomorrow.toISOString())).toBe(false);
    });
  });

  describe("isDueThisWeek", () => {
    it("returns false for undefined", () => {
      expect(isDueThisWeek(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isDueThisWeek("")).toBe(false);
    });

    it("returns true for today", () => {
      const today = new Date();
      expect(isDueThisWeek(today.toISOString())).toBe(true);
    });

    it("returns true for dates within 7 days", () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      expect(isDueThisWeek(future.toISOString())).toBe(true);
    });

    it("returns true for overdue tasks", () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      expect(isDueThisWeek(past.toISOString())).toBe(true);
    });

    it("returns false for dates beyond 7 days", () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(isDueThisWeek(future.toISOString())).toBe(false);
    });
  });
});
