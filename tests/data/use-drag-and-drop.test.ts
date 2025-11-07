import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDragAndDrop } from "@/lib/use-drag-and-drop";
import { moveTaskToQuadrant } from "@/lib/tasks";
import { ErrorActions, ErrorMessages } from "@/lib/error-logger";
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
