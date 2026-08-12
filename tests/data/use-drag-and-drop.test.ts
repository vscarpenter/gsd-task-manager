import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { moveTaskToQuadrant } from "@/lib/tasks";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";
import { KeyboardSensor, useSensor } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

vi.mock("@/lib/tasks", () => ({
  moveTaskToQuadrant: vi.fn(),
}));

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual("@dnd-kit/core");
  return {
    ...actual,
    useSensors: vi.fn(() => []),
    useSensor: vi.fn(() => ({})),
    PointerSensor: vi.fn(),
    TouchSensor: vi.fn(),
  };
});

describe("useDragAndDrop", () => {
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sensors and handleDragEnd function", () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    expect(result.current).toHaveProperty("sensors");
    expect(result.current).toHaveProperty("handleDragEnd");
    expect(typeof result.current.handleDragEnd).toBe("function");
  });

  it("configures a KeyboardSensor with sortable coordinates for accessible drag-and-drop", () => {
    renderHook(() => useDragAndDrop(mockOnError));

    expect(useSensor).toHaveBeenCalledWith(
      KeyboardSensor,
      expect.objectContaining({ coordinateGetter: expect.any(Function) })
    );
  });

  it("moves task to new quadrant on drag end", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "urgent-important", data: { current: {} } },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent("mousedown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    expect(moveTaskToQuadrant).toHaveBeenCalledWith(
      "task-1",
      "urgent-important"
    );
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it("does nothing when no drop target", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: null,
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent("mousedown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    expect(moveTaskToQuadrant).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it("does nothing when dropped on self", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "task-1", data: { current: {} } },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent("mousedown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    expect(moveTaskToQuadrant).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  // The defect this suite missed: dropping on a *different* card. `over.id` was
  // cast straight to a QuadrantId, so the write got a task id and threw. Cards
  // are droppables (useSortable), so every keyboard drag lands here.
  it("resolves the quadrant from a card drop target", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: {
        id: "task-2",
        data: { current: { sortable: { containerId: "not-urgent-important", index: 0, items: [] } } },
      },
      delta: { x: 0, y: 0 },
      activatorEvent: new KeyboardEvent("keydown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    expect(moveTaskToQuadrant).toHaveBeenCalledWith("task-1", "not-urgent-important");
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it("ignores a drop target that resolves to no quadrant", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "some-unrelated-droppable", data: { current: {} } },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent("mousedown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    // Not a failure — just not a drop target. No write, no error toast.
    expect(moveTaskToQuadrant).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it("does not move when the card is already in the target quadrant", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: {
        id: "task-1",
        data: { current: { sortable: { containerId: "urgent-important", index: 0, items: [] } } },
      },
      over: {
        id: "task-2",
        data: { current: { sortable: { containerId: "urgent-important", index: 1, items: [] } } },
      },
      delta: { x: 0, y: 0 },
      activatorEvent: new KeyboardEvent("keydown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    expect(moveTaskToQuadrant).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });

  it("announces the drop as pending, never as succeeded", () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const message = result.current.announcements.onDragEnd?.({
      active: { id: "task-1", data: { current: {} } },
      over: { id: "not-urgent-important", data: { current: {} } },
    } as never);

    // The write hasn't run yet, so this must not claim the move happened.
    expect(message).toMatch(/moving/i);
    expect(message).not.toMatch(/moved/i);
  });

  it("reports the settled outcome only after the write resolves", async () => {
    const { result } = renderHook(() => useDragAndDrop(mockOnError));
    expect(result.current.statusMessage).toBe("");

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "not-urgent-important", data: { current: {} } },
      delta: { x: 0, y: 0 },
      activatorEvent: new KeyboardEvent("keydown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await act(async () => {
      await result.current.handleDragEnd(mockEvent);
    });

    expect(result.current.statusMessage).toMatch(/moved to Schedule/i);
  });

  it("announces failure rather than success when the move rejects", async () => {
    vi.mocked(moveTaskToQuadrant).mockRejectedValueOnce(new Error("Move failed"));
    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "not-urgent-important", data: { current: {} } },
      delta: { x: 0, y: 0 },
      activatorEvent: new KeyboardEvent("keydown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await act(async () => {
      await result.current.handleDragEnd(mockEvent);
    });

    // A screen-reader user was previously told the drop succeeded here.
    expect(result.current.statusMessage).not.toMatch(/moved to/i);
    expect(result.current.statusMessage).toBe(ErrorMessages.TASK_MOVE_FAILED);
  });

  it("calls onError when move fails", async () => {
    const error = new Error("Move failed");
    vi.mocked(moveTaskToQuadrant).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useDragAndDrop(mockOnError));

    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "urgent-important", data: { current: {} } },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent("mousedown"),
      collisions: null,
    } as unknown as DragEndEvent;

    await result.current.handleDragEnd(mockEvent);

    expect(mockOnError).toHaveBeenCalledWith(error, {
      action: ErrorActions.MOVE_TASK,
      taskId: "task-1",
      userMessage: ErrorMessages.TASK_MOVE_FAILED,
      timestamp: expect.any(String),
      metadata: { targetQuadrant: "urgent-important" },
    });
  });
});
