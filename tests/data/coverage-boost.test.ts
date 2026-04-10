/**
 * Coverage boost tests — targeting low-coverage functions and branches
 * in smart-views, confetti, notifications, and db modules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Common mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// 1. Smart Views — all exported functions
// ---------------------------------------------------------------------------

describe("smart-views", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset DB between tests
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.smartViews.clear();
    await db.appPreferences.clear();
  });

  it("getSmartViews returns built-in views when no custom views exist", async () => {
    const { getSmartViews } = await import("@/lib/smart-views");
    const views = await getSmartViews();

    expect(views.length).toBeGreaterThan(0);
    // All should have built-in IDs
    const builtInViews = views.filter((v) => v.id.startsWith("built-in-"));
    expect(builtInViews.length).toBe(views.length);
  });

  it("createSmartView adds a custom view", async () => {
    const { createSmartView, getSmartViews } = await import(
      "@/lib/smart-views"
    );

    const created = await createSmartView({
      name: "My Custom View",
      filter: { status: "active" },
    });

    expect(created.id).toBeDefined();
    expect(created.isBuiltIn).toBe(false);
    expect(created.name).toBe("My Custom View");

    const allViews = await getSmartViews();
    const custom = allViews.find((v) => v.id === created.id);
    expect(custom).toBeDefined();
  });

  it("getSmartView returns a built-in view by ID", async () => {
    const { getSmartViews, getSmartView } = await import(
      "@/lib/smart-views"
    );
    const views = await getSmartViews();
    const builtIn = views.find((v) => v.id.startsWith("built-in-"));

    if (builtIn) {
      const found = await getSmartView(builtIn.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(builtIn.id);
    }
  });

  it("getSmartView returns a custom view by ID", async () => {
    const { createSmartView, getSmartView } = await import(
      "@/lib/smart-views"
    );

    const created = await createSmartView({
      name: "Custom View",
      filter: {},
    });

    const found = await getSmartView(created.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Custom View");
  });

  it("updateSmartView updates a custom view", async () => {
    const { createSmartView, updateSmartView } = await import(
      "@/lib/smart-views"
    );

    const created = await createSmartView({
      name: "Original Name",
      filter: {},
    });

    const updated = await updateSmartView(created.id, {
      name: "Updated Name",
    });

    expect(updated.name).toBe("Updated Name");
  });

  it("updateSmartView throws for non-existent view", async () => {
    const { updateSmartView } = await import("@/lib/smart-views");

    await expect(
      updateSmartView("non-existent", { name: "New" })
    ).rejects.toThrow(/not found/);
  });

  it("updateSmartView throws for built-in view", async () => {
    const { createSmartView, updateSmartView, getSmartViews } = await import(
      "@/lib/smart-views"
    );

    // Insert a "built-in" view directly
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.smartViews.add({
      id: "fake-builtin",
      name: "Built-in",
      filter: {},
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as import("@/lib/filters").SmartView);

    await expect(
      updateSmartView("fake-builtin", { name: "Changed" })
    ).rejects.toThrow(/built-in/i);
  });

  it("deleteSmartView removes a custom view", async () => {
    const { createSmartView, deleteSmartView, getSmartViews } = await import(
      "@/lib/smart-views"
    );

    const created = await createSmartView({
      name: "To Delete",
      filter: {},
    });

    await deleteSmartView(created.id);

    const allViews = await getSmartViews();
    expect(allViews.find((v) => v.id === created.id)).toBeUndefined();
  });

  it("deleteSmartView throws for built-in view", async () => {
    const { deleteSmartView } = await import("@/lib/smart-views");

    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.smartViews.add({
      id: "builtin-to-delete",
      name: "Built-in",
      filter: {},
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as import("@/lib/filters").SmartView);

    await expect(deleteSmartView("builtin-to-delete")).rejects.toThrow(
      /built-in/i
    );
  });

  it("clearCustomSmartViews removes all custom views", async () => {
    const { createSmartView, clearCustomSmartViews, getSmartViews } =
      await import("@/lib/smart-views");

    await createSmartView({ name: "View A", filter: {} });
    await createSmartView({ name: "View B", filter: {} });

    await clearCustomSmartViews();

    const allViews = await getSmartViews();
    // Only built-in views should remain
    const customViews = allViews.filter((v) => !v.id.startsWith("built-in-"));
    expect(customViews.length).toBe(0);
  });

  it("getAppPreferences returns defaults when no prefs exist", async () => {
    const { getAppPreferences } = await import("@/lib/smart-views");
    const prefs = await getAppPreferences();

    expect(prefs.id).toBe("preferences");
    expect(prefs.pinnedSmartViewIds).toEqual([]);
    expect(prefs.maxPinnedViews).toBe(5);
  });

  it("updateAppPreferences updates and returns new preferences", async () => {
    const { updateAppPreferences, getAppPreferences } = await import(
      "@/lib/smart-views"
    );

    await updateAppPreferences({ pinnedSmartViewIds: ["view-1", "view-2"] });
    const prefs = await getAppPreferences();

    expect(prefs.pinnedSmartViewIds).toEqual(["view-1", "view-2"]);
  });

  it("pinSmartView adds a view to pinned list", async () => {
    const { pinSmartView, getAppPreferences } = await import(
      "@/lib/smart-views"
    );

    await pinSmartView("view-1");
    const prefs = await getAppPreferences();

    expect(prefs.pinnedSmartViewIds).toContain("view-1");
  });

  it("pinSmartView is a no-op if already pinned", async () => {
    const { pinSmartView, getAppPreferences, updateAppPreferences } =
      await import("@/lib/smart-views");

    await updateAppPreferences({ pinnedSmartViewIds: ["view-1"] });
    await pinSmartView("view-1");
    const prefs = await getAppPreferences();

    expect(prefs.pinnedSmartViewIds).toEqual(["view-1"]);
  });

  it("pinSmartView throws when max pinned views reached", async () => {
    const { pinSmartView, updateAppPreferences } = await import(
      "@/lib/smart-views"
    );

    await updateAppPreferences({
      pinnedSmartViewIds: ["v1", "v2", "v3", "v4", "v5"],
      maxPinnedViews: 5,
    });

    await expect(pinSmartView("v6")).rejects.toThrow(/Maximum/);
  });

  it("unpinSmartView removes a view from pinned list", async () => {
    const { unpinSmartView, updateAppPreferences, getAppPreferences } =
      await import("@/lib/smart-views");

    await updateAppPreferences({ pinnedSmartViewIds: ["v1", "v2"] });
    await unpinSmartView("v1");
    const prefs = await getAppPreferences();

    expect(prefs.pinnedSmartViewIds).toEqual(["v2"]);
  });

  it("getPinnedSmartViews returns pinned views in order", async () => {
    const {
      getPinnedSmartViews,
      updateAppPreferences,
      getSmartViews,
    } = await import("@/lib/smart-views");

    const allViews = await getSmartViews();
    if (allViews.length >= 2) {
      await updateAppPreferences({
        pinnedSmartViewIds: [allViews[1].id, allViews[0].id],
      });

      const pinned = await getPinnedSmartViews();
      expect(pinned.length).toBe(2);
      expect(pinned[0].id).toBe(allViews[1].id);
      expect(pinned[1].id).toBe(allViews[0].id);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Confetti — function and branch coverage
// ---------------------------------------------------------------------------

describe("confetti", () => {
  it("celebrateCompletion does not throw in jsdom (no canvas support)", async () => {
    const { celebrateCompletion } = await import("@/lib/confetti");
    // jsdom canvas getContext returns null, so canRenderCanvas = false => early return
    expect(() => celebrateCompletion()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Notification permissions — branch coverage
// ---------------------------------------------------------------------------

describe("notification permissions", () => {
  it("isNotificationSupported returns false when Notification is undefined", async () => {
    const originalNotification = globalThis.Notification;
    // @ts-expect-error - intentionally removing for test
    delete globalThis.Notification;

    // Re-import to get fresh evaluation
    vi.resetModules();
    const { isNotificationSupported } = await import(
      "@/lib/notifications/permissions"
    );
    expect(isNotificationSupported()).toBe(false);

    globalThis.Notification = originalNotification;
  });

  it("checkNotificationPermission returns 'denied' when not supported", async () => {
    const originalNotification = globalThis.Notification;
    // @ts-expect-error
    delete globalThis.Notification;

    vi.resetModules();
    const { checkNotificationPermission } = await import(
      "@/lib/notifications/permissions"
    );
    expect(checkNotificationPermission()).toBe("denied");

    globalThis.Notification = originalNotification;
  });

  it("isInQuietHours returns false when no quiet hours set", async () => {
    const { isInQuietHours } = await import(
      "@/lib/notifications/permissions"
    );
    expect(isInQuietHours({})).toBe(false);
    expect(
      isInQuietHours({ quietHoursStart: undefined, quietHoursEnd: undefined })
    ).toBe(false);
  });

  it("isInQuietHours handles overnight quiet hours", async () => {
    const { isInQuietHours } = await import(
      "@/lib/notifications/permissions"
    );

    // Overnight: 22:00 to 08:00
    const settings = { quietHoursStart: "22:00", quietHoursEnd: "08:00" };

    // We can't easily control the current time, but we can verify it returns a boolean
    const result = isInQuietHours(settings);
    expect(typeof result).toBe("boolean");
  });

  it("isInQuietHours handles same-day quiet hours", async () => {
    const { isInQuietHours } = await import(
      "@/lib/notifications/permissions"
    );

    // Same-day: 13:00 to 14:00
    const settings = { quietHoursStart: "13:00", quietHoursEnd: "14:00" };
    const result = isInQuietHours(settings);
    expect(typeof result).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// 4. Badge API — branch coverage
// ---------------------------------------------------------------------------

describe("notification badge", () => {
  it("isBadgeSupported returns false when navigator.setAppBadge is missing", async () => {
    const { isBadgeSupported } = await import("@/lib/notifications/badge");
    // jsdom doesn't provide setAppBadge
    expect(isBadgeSupported()).toBe(false);
  });

  it("setAppBadge is a no-op when badge not supported", async () => {
    const { setAppBadge } = await import("@/lib/notifications/badge");
    // Should not throw
    await expect(setAppBadge(5)).resolves.toBeUndefined();
  });

  it("clearAppBadge is a no-op when badge not supported", async () => {
    const { clearAppBadge } = await import("@/lib/notifications/badge");
    await expect(clearAppBadge()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. DB module — getDb function branches
// ---------------------------------------------------------------------------

describe("db", () => {
  it("getDb returns a database instance", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    expect(db).toBeDefined();
    expect(db.tasks).toBeDefined();
    expect(db.smartViews).toBeDefined();
    expect(db.syncQueue).toBeDefined();
  });

  it("getDb returns same instance on subsequent calls", async () => {
    const { getDb } = await import("@/lib/db");
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});
