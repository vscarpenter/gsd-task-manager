import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSmartViews } from "@/components/matrix-simplified/use-smart-views";
import { getDb } from "@/lib/db";
import {
  APP_PREFERENCES_EVENT,
  createSmartView,
  updateAppPreferences,
  type AppPreferencesEventDetail,
} from "@/lib/smart-views";
import type { AppPreferences } from "@/lib/types";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

function preferences(smartViewsEnabled: boolean): AppPreferences {
  return {
    id: "preferences",
    pinnedSmartViewIds: [],
    maxPinnedViews: 5,
    smartViewsEnabled,
  };
}

describe("useSmartViews", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getDb();
    await db.smartViews.clear();
    await db.appPreferences.clear();
  });

  it("loads enabled preferences and available smart views", async () => {
    await updateAppPreferences({ smartViewsEnabled: true });
    const customView = await createSmartView({
      name: "Focused Work",
      criteria: { tags: ["focus"] },
    });

    const { result } = renderHook(() => useSmartViews(vi.fn()));

    await waitFor(() => expect(result.current.smartViewsEnabled).toBe(true));
    await waitFor(() =>
      expect(result.current.smartViews.map((view) => view.id)).toContain(customView.id)
    );
  });

  it("clears search and tracks the active view when applying a smart view", async () => {
    const customView = await createSmartView({
      name: "Ready To Ship",
      criteria: { tags: ["ship"] },
    });
    const clearSearch = vi.fn();
    const { result } = renderHook(() => useSmartViews(clearSearch));

    await act(async () => {
      await result.current.applySmartViewById(customView.id);
    });

    expect(clearSearch).toHaveBeenCalledTimes(1);
    expect(result.current.activeSmartView).toMatchObject({
      id: customView.id,
      name: "Ready To Ship",
    });
  });

  it("keeps the current filter untouched and reports an error for a missing view", async () => {
    const clearSearch = vi.fn();
    const { result } = renderHook(() => useSmartViews(clearSearch));

    await act(async () => {
      await result.current.applySmartViewById("missing-view");
    });

    expect(clearSearch).not.toHaveBeenCalled();
    expect(result.current.activeSmartView).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Smart view not found", expect.any(Object));
  });

  it("clears an active smart view when preferences disable the feature", async () => {
    const customView = await createSmartView({
      name: "Blocked Work",
      criteria: { status: "active" },
    });
    const { result } = renderHook(() => useSmartViews(vi.fn()));

    await act(async () => {
      await result.current.applySmartViewById(customView.id);
    });
    expect(result.current.activeSmartView?.id).toBe(customView.id);

    act(() => {
      window.dispatchEvent(
        new CustomEvent<AppPreferencesEventDetail>(APP_PREFERENCES_EVENT, {
          detail: { preferences: preferences(false) },
        })
      );
    });

    expect(result.current.smartViewsEnabled).toBe(false);
    expect(result.current.activeSmartView).toBeNull();
  });
});
