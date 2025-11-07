import { describe, it, expect } from "vitest";
import {
  DND_CONFIG,
  TOAST_DURATION,
  NOTIFICATION_TIMING,
  NOTIFICATION_ASSETS,
  TIME_UTILS,
} from "@/lib/constants";

describe("constants", () => {
  describe("DND_CONFIG", () => {
    it("has pointer distance configuration", () => {
      expect(DND_CONFIG.POINTER_DISTANCE).toBe(8);
    });

    it("has touch delay configuration", () => {
      expect(DND_CONFIG.TOUCH_DELAY).toBe(250);
    });

    it("has touch tolerance configuration", () => {
      expect(DND_CONFIG.TOUCH_TOLERANCE).toBe(5);
    });
  });

  describe("TOAST_DURATION", () => {
    it("has short duration", () => {
      expect(TOAST_DURATION.SHORT).toBe(3000);
    });

    it("has long duration", () => {
      expect(TOAST_DURATION.LONG).toBe(5000);
    });
  });

  describe("NOTIFICATION_TIMING", () => {
    it("has auto close duration", () => {
      expect(NOTIFICATION_TIMING.AUTO_CLOSE_DURATION).toBe(10000);
    });

    it("has test notification duration", () => {
      expect(NOTIFICATION_TIMING.TEST_NOTIFICATION_DURATION).toBe(5000);
    });

    it("has milliseconds per minute", () => {
      expect(NOTIFICATION_TIMING.MS_PER_MINUTE).toBe(60000);
    });

    it("has minutes per hour", () => {
      expect(NOTIFICATION_TIMING.MINUTES_PER_HOUR).toBe(60);
    });

    it("has minutes per day", () => {
      expect(NOTIFICATION_TIMING.MINUTES_PER_DAY).toBe(1440);
    });

    it("has overdue notification threshold", () => {
      expect(NOTIFICATION_TIMING.OVERDUE_NOTIFICATION_THRESHOLD).toBe(-60);
    });

    it("has default check interval", () => {
      expect(NOTIFICATION_TIMING.DEFAULT_CHECK_INTERVAL_MINUTES).toBe(1);
    });

    it("has background sync interval", () => {
      expect(NOTIFICATION_TIMING.BACKGROUND_SYNC_INTERVAL_MINUTES).toBe(15);
    });

    it("has default reminder minutes", () => {
      expect(NOTIFICATION_TIMING.DEFAULT_REMINDER_MINUTES).toBe(15);
    });
  });

  describe("NOTIFICATION_ASSETS", () => {
    it("has 192x192 icon path", () => {
      expect(NOTIFICATION_ASSETS.ICON_192).toBe("/icon-192.png");
    });

    it("has badge icon path", () => {
      expect(NOTIFICATION_ASSETS.BADGE).toBe("/icon-192.png");
    });
  });

  describe("TIME_UTILS", () => {
    it("converts hours to minutes", () => {
      expect(TIME_UTILS.hoursToMinutes(2)).toBe(120);
      expect(TIME_UTILS.hoursToMinutes(24)).toBe(1440);
    });

    it("converts days to minutes", () => {
      expect(TIME_UTILS.daysToMinutes(1)).toBe(1440);
      expect(TIME_UTILS.daysToMinutes(7)).toBe(10080);
    });

    it("converts milliseconds to minutes", () => {
      expect(TIME_UTILS.msToMinutes(60000)).toBe(1);
      expect(TIME_UTILS.msToMinutes(3600000)).toBe(60);
    });

    it("converts time to minutes since midnight", () => {
      expect(TIME_UTILS.timeToMinutes(0, 0)).toBe(0);
      expect(TIME_UTILS.timeToMinutes(12, 30)).toBe(750);
      expect(TIME_UTILS.timeToMinutes(23, 59)).toBe(1439);
    });
  });
});
