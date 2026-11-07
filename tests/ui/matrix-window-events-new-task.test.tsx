import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMatrixWindowEvents } from "@/components/matrix-simplified/use-matrix-window-events";
import { UI_TIMING } from "@/lib/constants/ui";

function mount(input: HTMLInputElement) {
  return renderHook(() =>
    useMatrixWindowEvents({
      searchInputRef: { current: null },
      captureInputRef: { current: input },
      openCreateDrawer: vi.fn(),
      highlightTaskById: vi.fn(),
      applySmartViewById: vi.fn(async () => {}),
      focusQuadrant: vi.fn(),
    })
  );
}

function setup() {
  const input = document.createElement("input");
  document.body.appendChild(input);
  return { input, ...mount(input) };
}

describe("the ?action=new-task URL action", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/?action=new-task");
  });
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, "", "/");
    document.body.innerHTML = "";
  });

  it("focuses the capture input, then cleans the URL", () => {
    const { input } = setup();

    act(() => vi.advanceTimersByTime(UI_TIMING.FOCUS_DELAY_MS));

    expect(input).toHaveFocus();
    expect(window.location.search).toBe("");
  });

  it("keeps what other effects removed in the meantime: it cleans the URL as it is when the timer fires", () => {
    // The deep-link effect consumes highlight right away. A cleanup built from the URL as it
    // was when this effect ran would put it back, and a reload would replay the highlight.
    window.history.replaceState(null, "", "/?action=new-task&highlight=task-1&keep=1");
    setup();

    act(() => vi.advanceTimersByTime(UI_TIMING.FOCUS_DELAY_MS));

    expect(window.location.search).toBe("?keep=1");
  });

  it("still focuses when the effect is torn down and run again, as StrictMode does in development", () => {
    const { input, unmount } = setup();

    // StrictMode mounts, cleans up, and mounts again without touching the URL in between.
    unmount();
    mount(input);
    act(() => vi.advanceTimersByTime(UI_TIMING.FOCUS_DELAY_MS));

    expect(input).toHaveFocus();
    expect(window.location.search).toBe("");
  });
});
