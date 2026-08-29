import { describe, it, expect, beforeEach } from "vitest";
import {
  getNotificationSettings,
  updateNotificationSettings,
  toggleNotificationSound,
  toggleQuietHours,
  setQuietHoursEdge,
} from "@/lib/notifications/settings";
import { getDb } from "@/lib/db";

describe("notification control mutations", () => {
  beforeEach(async () => {
    await getDb().notificationSettings.clear();
  });

  describe("toggleNotificationSound", () => {
    it("flips soundEnabled from its default on", async () => {
      await toggleNotificationSound();
      expect((await getNotificationSettings()).soundEnabled).toBe(false);

      await toggleNotificationSound();
      expect((await getNotificationSettings()).soundEnabled).toBe(true);
    });
  });

  describe("toggleQuietHours", () => {
    it("seeds the overnight window when no hours are set", async () => {
      await toggleQuietHours();

      const settings = await getNotificationSettings();
      expect(settings.quietHoursStart).toBe("22:00");
      expect(settings.quietHoursEnd).toBe("08:00");
    });

    it("clears both edges when the window is set", async () => {
      await updateNotificationSettings({ quietHoursStart: "21:00", quietHoursEnd: "07:00" });

      await toggleQuietHours();

      const settings = await getNotificationSettings();
      expect(settings.quietHoursStart).toBeUndefined();
      expect(settings.quietHoursEnd).toBeUndefined();
    });

    it("treats a single set edge as off and seeds the full window", async () => {
      // Half-set state can't fire (isInQuietHours needs both edges), so the
      // toggle reads it as off and completes the window.
      await updateNotificationSettings({ quietHoursStart: "23:00" });

      await toggleQuietHours();

      const settings = await getNotificationSettings();
      expect(settings.quietHoursStart).toBe("22:00");
      expect(settings.quietHoursEnd).toBe("08:00");
    });
  });

  describe("setQuietHoursEdge", () => {
    it("updates only the named edge", async () => {
      await updateNotificationSettings({ quietHoursStart: "22:00", quietHoursEnd: "08:00" });

      await setQuietHoursEdge("start", "21:30");
      expect((await getNotificationSettings()).quietHoursStart).toBe("21:30");
      expect((await getNotificationSettings()).quietHoursEnd).toBe("08:00");

      await setQuietHoursEdge("end", "07:15");
      expect((await getNotificationSettings()).quietHoursEnd).toBe("07:15");
    });

    it("ignores an empty value — an emptied time input is not a window edge", async () => {
      await updateNotificationSettings({ quietHoursStart: "22:00", quietHoursEnd: "08:00" });

      await setQuietHoursEdge("start", "");

      expect((await getNotificationSettings()).quietHoursStart).toBe("22:00");
    });
  });
});
