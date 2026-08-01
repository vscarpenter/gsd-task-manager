import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLY_SMART_VIEW_EVENT,
  FOCUS_CAPTURE_EVENT,
  FOCUS_QUADRANT_EVENT,
  HIGHLIGHT_TASK_EVENT,
  NEW_TASK_EVENT,
} from "@/lib/use-shell-command-handlers";
import { UI_TIMING } from "@/lib/constants/ui";
import { useMatrixWindowEvents } from "@/components/matrix-simplified/use-matrix-window-events";
import { createTask } from "@/lib/tasks";
import { toast } from "sonner";

vi.mock("@/lib/tasks", () => ({
  createTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function makeInput(id: string): HTMLInputElement {
  const input = document.createElement("input");
  input.id = id;
  document.body.append(input);
  return input;
}

describe("useMatrixWindowEvents", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens bookmarklet fragment data for confirmation without persisting", async () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const openCreateDrawer = vi.fn();
    window.history.replaceState(
      {},
      "",
      "/?keep=1#action=capture&title=Read%20this&url=https%3A%2F%2Fexample.com%2Farticle%3Fx%3D1&tags=Ops,Ops,Research&anchor=matrix"
    );

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer,
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant: vi.fn(),
      })
    );

    await waitFor(() =>
      expect(openCreateDrawer).toHaveBeenCalledWith({
        title: "Read this",
        description: "https://example.com/article?x=1",
        urgent: false,
        important: false,
        tags: ["ops", "research"],
      })
    );
    expect(createTask).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#anchor=matrix");
  });

  it("rejects and removes legacy query-string capture data", async () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const openCreateDrawer = vi.fn();
    window.history.replaceState(
      {},
      "",
      "/?action=capture&title=Legacy%20private%20task&url=https%3A%2F%2Finternal.example%2Fprivate&keep=1#matrix"
    );

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer,
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant: vi.fn(),
      })
    );

    await waitFor(() => expect(window.location.search).toBe("?keep=1"));
    expect(window.location.hash).toBe("#matrix");
    expect(openCreateDrawer).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("keeps pending new-task focus when the drawer callback identity changes", () => {
    vi.useFakeTimers();
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const searchInputRef = { current: searchInput };
    const captureInputRef = { current: captureInput };
    window.history.replaceState({}, "", "/?action=new-task");

    const { rerender } = renderHook(
      ({ openCreateDrawer }) =>
        useMatrixWindowEvents({
          searchInputRef,
          captureInputRef,
          openCreateDrawer,
          highlightTaskById: vi.fn(),
          applySmartViewById: vi.fn(),
          focusQuadrant: vi.fn(),
        }),
      { initialProps: { openCreateDrawer: vi.fn() } }
    );

    rerender({ openCreateDrawer: vi.fn() });
    act(() => {
      vi.advanceTimersByTime(UI_TIMING.FOCUS_DELAY_MS);
    });

    expect(document.activeElement).toBe(captureInput);
  });

  it("ignores global shortcuts while typing and focuses search from the page body", () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const openHelpSpy = vi.fn();
    window.addEventListener("gsd:open-help", openHelpSpy);

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer: vi.fn(),
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant: vi.fn(),
      })
    );

    captureInput.focus();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });
    expect(document.activeElement).toBe(captureInput);

    captureInput.blur();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });
    expect(document.activeElement).toBe(searchInput);

    searchInput.blur();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });
    expect(openHelpSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("gsd:open-help", openHelpSpy);
  });

  it("suppresses legacy search and help shortcuts while a modal is open", () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const openHelpSpy = vi.fn();
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const modalButton = document.createElement("button");
    modal.append(modalButton);
    document.body.append(modal);
    window.addEventListener("gsd:open-help", openHelpSpy);

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer: vi.fn(),
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant: vi.fn(),
      })
    );

    modalButton.focus();
    act(() => {
      modalButton.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
      modalButton.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });

    expect(document.activeElement).toBe(modalButton);
    expect(searchInput).not.toHaveFocus();
    expect(openHelpSpy).not.toHaveBeenCalled();
    window.removeEventListener("gsd:open-help", openHelpSpy);
    modal.remove();
  });

  it("applies deep-link and shell event actions without leaving command params in the URL", async () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const openCreateDrawer = vi.fn();
    const highlightTaskById = vi.fn();
    const applySmartViewById = vi.fn().mockResolvedValue(undefined);
    window.history.replaceState({}, "", "/?highlight=task-1&smartView=view-1&keep=1");
    const frameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer,
        highlightTaskById,
        applySmartViewById,
        focusQuadrant: vi.fn(),
      })
    );

    await waitFor(() => expect(highlightTaskById).toHaveBeenCalledWith("task-1"));
    expect(applySmartViewById).toHaveBeenCalledWith("view-1");
    expect(window.location.search).toBe("?keep=1");

    act(() => {
      window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT));
      window.dispatchEvent(new CustomEvent(HIGHLIGHT_TASK_EVENT, { detail: { taskId: "task-2" } }));
      window.dispatchEvent(new CustomEvent(APPLY_SMART_VIEW_EVENT, { detail: { viewId: "view-2" } }));
    });

    expect(openCreateDrawer).toHaveBeenCalledTimes(1);
    expect(highlightTaskById).toHaveBeenLastCalledWith("task-2");
    expect(applySmartViewById).toHaveBeenLastCalledWith("view-2");
    frameSpy.mockRestore();
  });

  it("delivers capture and quadrant focus commands without opening the composer", () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const focusQuadrant = vi.fn();
    const openCreateDrawer = vi.fn();

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer,
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant,
      })
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(FOCUS_CAPTURE_EVENT));
      window.dispatchEvent(
        new CustomEvent(FOCUS_QUADRANT_EVENT, { detail: { quadrant: "q2" } })
      );
    });

    expect(document.activeElement).toBe(captureInput);
    expect(focusQuadrant).toHaveBeenCalledWith("q2");
    expect(openCreateDrawer).not.toHaveBeenCalled();
  });

  it("consumes a cross-route quadrant focus query and preserves unrelated params", async () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const focusQuadrant = vi.fn();
    window.history.replaceState({}, "", "/?focusQuadrant=q3&keep=1");
    const frameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer: vi.fn(),
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant,
      })
    );

    await waitFor(() => expect(focusQuadrant).toHaveBeenCalledWith("q3"));
    expect(window.location.search).toBe("?keep=1");
    frameSpy.mockRestore();
  });

  it("queues cross-route quadrant focus before render churn can cancel the next frame", () => {
    const searchInput = makeInput("search");
    const captureInput = makeInput("capture");
    const focusQuadrant = vi.fn();
    window.history.replaceState({}, "", "/?focusQuadrant=q2");
    const frameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    const { unmount } = renderHook(() =>
      useMatrixWindowEvents({
        searchInputRef: { current: searchInput },
        captureInputRef: { current: captureInput },
        openCreateDrawer: vi.fn(),
        highlightTaskById: vi.fn(),
        applySmartViewById: vi.fn(),
        focusQuadrant,
      })
    );

    expect(focusQuadrant).toHaveBeenCalledWith("q2");
    unmount();
    frameSpy.mockRestore();
  });
});
