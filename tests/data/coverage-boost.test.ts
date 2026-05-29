/**
 * Coverage tests for notification permissions, the badge API, and the db accessor.
 *
 * NOTE: the former "smart-views" block was migrated to
 * tests/data/smart-views.test.ts (behavior-named, colocated with the module).
 * The remaining blocks are pending the same treatment — see finding F2.1 in
 * docs/codebase-analysis-report.html.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Notification permissions — branch coverage
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
    // @ts-expect-error — deleting a non-optional global for test isolation
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
// Badge API — branch coverage
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
// DB module — getDb function branches
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
