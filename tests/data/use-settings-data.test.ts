import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockGetNotificationSettings = vi.fn();
const mockUpdateNotificationSettings = vi.fn();
const mockGetSyncStatus = vi.fn();
const mockGetAppPreferences = vi.fn();
const mockUpdateAppPreferences = vi.fn();
const mockReadShowCompleted = vi.fn();
const mockErrorLog = vi.fn();

vi.mock("@/lib/notifications", () => ({
  getNotificationSettings: (...a: unknown[]) => mockGetNotificationSettings(...a),
  updateNotificationSettings: (...a: unknown[]) => mockUpdateNotificationSettings(...a),
}));
vi.mock("@/lib/sync/config", () => ({
  getSyncStatus: (...a: unknown[]) => mockGetSyncStatus(...a),
}));
vi.mock("@/lib/smart-views", () => ({
  APP_PREFERENCES_EVENT: "gsd:app-preferences",
  getAppPreferences: (...a: unknown[]) => mockGetAppPreferences(...a),
  updateAppPreferences: (...a: unknown[]) => mockUpdateAppPreferences(...a),
}));
vi.mock("@/lib/preferences/show-completed", () => ({
  SHOW_COMPLETED_EVENT: "gsd:show-completed",
  SHOW_COMPLETED_KEY: "gsd:show-completed-key",
  readShowCompleted: (...a: unknown[]) => mockReadShowCompleted(...a),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: (...a: unknown[]) => mockErrorLog(...a),
  }),
}));

import { useSettingsData } from "@/components/settings-page/use-settings-data";

const NOTIF = {
  id: "settings",
  enabled: false,
  defaultReminder: 30,
  soundEnabled: true,
  permissionAsked: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem("gsd:show-completed-key");
  mockGetNotificationSettings.mockResolvedValue(NOTIF);
  mockUpdateNotificationSettings.mockResolvedValue(undefined);
  mockGetSyncStatus.mockResolvedValue({ enabled: true, pendingCount: 3 });
  mockGetAppPreferences.mockResolvedValue({ id: "preferences", smartViewsEnabled: false });
  mockUpdateAppPreferences.mockResolvedValue({ id: "preferences", smartViewsEnabled: true });
  mockReadShowCompleted.mockReturnValue(true);
});

async function renderLoaded() {
  const hook = renderHook(() => useSettingsData());
  await waitFor(() => expect(hook.result.current.dataLoaded).toBe(true));
  return hook;
}

describe("useSettingsData", () => {
  it("loads async-sourced settings on mount", async () => {
    const { result } = await renderLoaded();
    expect(result.current.notificationSettings).toEqual(NOTIF);
    expect(result.current.appPreferences?.smartViewsEnabled).toBe(false);
    expect(result.current.syncEnabled).toBe(true);
    expect(result.current.pendingSync).toBe(3);
    expect(result.current.showCompleted).toBe(true);
  });

  it("logs and stays unloaded when the initial load fails", async () => {
    mockGetSyncStatus.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSettingsData());
    await waitFor(() => expect(mockErrorLog).toHaveBeenCalled());
    expect(result.current.dataLoaded).toBe(false);
  });

  it("toggles show-completed, persisting and broadcasting the change", async () => {
    mockReadShowCompleted.mockReturnValue(false);
    const { result } = await renderLoaded();
    const listener = vi.fn();
    window.addEventListener("gsd:show-completed", listener);

    act(() => result.current.toggleCompleted());

    expect(localStorage.getItem("gsd:show-completed-key")).toBe("true");
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ show: true });
    window.removeEventListener("gsd:show-completed", listener);
  });

  it("toggles smart views and broadcasts the updated preferences", async () => {
    const { result } = await renderLoaded();
    const listener = vi.fn();
    window.addEventListener("gsd:app-preferences", listener);

    await act(async () => {
      await result.current.toggleSmartViews();
    });

    expect(mockUpdateAppPreferences).toHaveBeenCalledWith({ smartViewsEnabled: true });
    expect(result.current.appPreferences?.smartViewsEnabled).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("gsd:app-preferences", listener);
  });

  it("is a no-op toggling smart views before preferences load", async () => {
    mockGetAppPreferences.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useSettingsData());
    await act(async () => {
      await result.current.toggleSmartViews();
    });
    expect(mockUpdateAppPreferences).not.toHaveBeenCalled();
  });

  it("enables notifications when permission is granted", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { requestPermission });
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.notificationToggle();
    });

    expect(requestPermission).toHaveBeenCalled();
    expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({ enabled: true });
    vi.unstubAllGlobals();
  });

  it("does not enable notifications when permission is denied", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    vi.stubGlobal("Notification", { requestPermission });
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.notificationToggle();
    });

    expect(mockUpdateNotificationSettings).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("disables notifications without requesting permission", async () => {
    mockGetNotificationSettings.mockResolvedValue({ ...NOTIF, enabled: true });
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.notificationToggle();
    });

    expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({ enabled: false });
  });

  it("updates the default reminder", async () => {
    const { result } = await renderLoaded();
    await act(async () => {
      await result.current.defaultReminderChange("60");
    });
    expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({ defaultReminder: 60 });
  });

  it("clears sync state when the account is deleted", async () => {
    const { result } = await renderLoaded();
    act(() => result.current.markAccountDeleted());
    expect(result.current.syncEnabled).toBe(false);
    expect(result.current.pendingSync).toBe(0);
  });
});
