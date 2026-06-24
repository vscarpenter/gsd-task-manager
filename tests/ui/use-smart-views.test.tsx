import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useSmartViews } from "@/components/matrix-simplified/use-smart-views";
import type { SmartView } from "@/lib/filters";
import {
  APP_PREFERENCES_EVENT,
  getAppPreferences,
  getSmartView,
  getSmartViews,
} from "@/lib/smart-views";
import type { AppPreferences } from "@/lib/types";

vi.mock("@/lib/smart-views", () => ({
  APP_PREFERENCES_EVENT: "gsd:app-preferences",
  getAppPreferences: vi.fn(),
  getSmartView: vi.fn(),
  getSmartViews: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const enabledPreferences: AppPreferences = {
  id: "preferences",
  pinnedSmartViewIds: [],
  maxPinnedViews: 5,
  smartViewsEnabled: true,
};

const disabledPreferences: AppPreferences = {
  ...enabledPreferences,
  smartViewsEnabled: false,
};

function makeView(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: "view-1",
    name: "Due Today",
    criteria: { dueToday: true },
    isBuiltIn: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useSmartViews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppPreferences).mockResolvedValue(enabledPreferences);
    vi.mocked(getSmartViews).mockResolvedValue([makeView()]);
    vi.mocked(getSmartView).mockImplementation(async (viewId) =>
      viewId === "view-1" ? makeView() : undefined
    );
  });

  it("loads enabled preferences and available smart views", async () => {
    const { result } = renderHook(() => useSmartViews(vi.fn()));

    await waitFor(() => expect(result.current.smartViewsEnabled).toBe(true));
    await waitFor(() => expect(result.current.smartViews).toEqual([makeView()]));

    expect(getAppPreferences).toHaveBeenCalledTimes(1);
    expect(getSmartViews).toHaveBeenCalledTimes(1);
  });

  it("applies a smart view by clearing search and setting the active filter", async () => {
    const clearSearch = vi.fn();
    const view = makeView({ name: "Ready To Work", criteria: { readyToWork: true } });
    vi.mocked(getSmartView).mockResolvedValue(view);
    const { result } = renderHook(() => useSmartViews(clearSearch));

    await act(async () => {
      await result.current.applySmartViewById("view-1");
    });

    expect(clearSearch).toHaveBeenCalledTimes(1);
    expect(result.current.activeSmartView).toEqual(view);
  });

  it("shows an error without mutating state when the requested smart view is missing", async () => {
    const clearSearch = vi.fn();
    vi.mocked(getSmartView).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSmartViews(clearSearch));

    await act(async () => {
      await result.current.applySmartViewById("missing-view");
    });

    expect(clearSearch).not.toHaveBeenCalled();
    expect(result.current.activeSmartView).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Smart view not found", expect.any(Object));
  });

  it("clears the active smart view when preferences disable the feature", async () => {
    const { result } = renderHook(() => useSmartViews(vi.fn()));

    await act(async () => {
      await result.current.applySmartViewById("view-1");
    });
    expect(result.current.activeSmartView).toEqual(makeView());

    act(() => {
      window.dispatchEvent(
        new CustomEvent(APP_PREFERENCES_EVENT, { detail: { preferences: disabledPreferences } })
      );
    });

    expect(result.current.smartViewsEnabled).toBe(false);
    expect(result.current.activeSmartView).toBeNull();
  });
});
