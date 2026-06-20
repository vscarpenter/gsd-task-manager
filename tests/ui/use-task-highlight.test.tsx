import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskHighlight } from "@/components/matrix-simplified/use-task-highlight";
import type { TaskRecord } from "@/lib/types";

function makeTask(id: string): TaskRecord {
  return {
    id,
    title: "Task",
    description: "",
    urgent: false,
    important: false,
    quadrant: "not-urgent-not-important",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    recurrence: "none",
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: false,
    notificationSent: false,
  };
}

describe("useTaskHighlight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears search, highlights the task, then removes the highlight after the timeout", () => {
    const clearSearch = vi.fn();
    const { result } = renderHook(() => useTaskHighlight([makeTask("target")], clearSearch));

    act(() => {
      result.current.highlightTaskById("target");
    });

    expect(clearSearch).toHaveBeenCalledTimes(1);
    expect(result.current.highlightedTaskId).toBe("target");

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(result.current.highlightedTaskId).toBeNull();
  });

  it("scrolls and focuses the registered task node when a highlight is requested", () => {
    const node = document.createElement("article");
    node.scrollIntoView = vi.fn();
    node.focus = vi.fn();
    const { result } = renderHook(() => useTaskHighlight([makeTask("target")], vi.fn()));

    act(() => {
      result.current.handleTaskRef("target", node);
      result.current.highlightTaskById("target");
    });

    expect(node.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(node.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
