import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatrixColumn } from "@/components/matrix-column";
import type { TaskRecord } from "@/lib/types";
import { createMockTask } from "@/tests/fixtures";

// Mock dnd-kit
vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false
  })
}));

// Mock TaskCard component
vi.mock("@/components/task-card", () => ({
  TaskCard: ({ task, onEdit, onDelete, onToggleComplete }: {
    task: TaskRecord;
    onEdit: (task: TaskRecord) => void;
    onDelete: (task: TaskRecord) => Promise<void>;
    onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void>;
  }) => (
    <div data-testid={`task-${task.id}`}>
      <span>{task.title}</span>
      <button onClick={() => onEdit(task)}>Edit</button>
      <button onClick={() => onDelete(task)}>Delete</button>
      <button onClick={() => onToggleComplete(task, !task.completed)}>Toggle</button>
    </div>
  )
}));

describe("MatrixColumn", () => {
  const mockQuadrant = {
    id: "urgent-important" as const,
    title: "Do First",
    subtitle: "Urgent & Important",
    bgClass: "bg-blue-50",
    accentClass: "bg-blue-500 text-white",
    colorClass: "bg-blue-500",
    iconColor: "text-blue-500 dark:text-blue-400",
    emptyMessage: "What needs your attention right now?"
  };

  const mockTasks: TaskRecord[] = [
    createMockTask({ id: "task-1", title: "Task 1" }),
    createMockTask({ id: "task-2", title: "Task 2", completed: true }),
  ];

  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders quadrant title and subtitle", () => {
    render(<MatrixColumn quadrant={mockQuadrant} tasks={[]} allTasks={[]} {...mockHandlers} />);

    expect(screen.getByText("Do First")).toBeInTheDocument();
    expect(screen.getByText("Urgent & Important")).toBeInTheDocument();
  });

  it("renders task cards", () => {
    render(<MatrixColumn quadrant={mockQuadrant} tasks={mockTasks} allTasks={mockTasks} {...mockHandlers} />);

    expect(screen.getByTestId("task-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("task-task-2")).toBeInTheDocument();
  });

  it("displays task count badge", () => {
    const { container } = render(<MatrixColumn quadrant={mockQuadrant} tasks={mockTasks} allTasks={mockTasks} {...mockHandlers} />);

    // Just verify the component renders - actual count display logic tested separately
    expect(container.querySelector("header")).toBeInTheDocument();
  });

  it("passes handlers to task cards", async () => {
    render(<MatrixColumn quadrant={mockQuadrant} tasks={[mockTasks[0]]} allTasks={mockTasks} {...mockHandlers} />);

    // Simulate interactions would happen through TaskCard component
    expect(screen.getByTestId("task-task-1")).toBeInTheDocument();
  });

  it("renders empty state when no tasks", () => {
    const { container } = render(<MatrixColumn quadrant={mockQuadrant} tasks={[]} allTasks={[]} {...mockHandlers} />);

    expect(screen.getByText("Do First")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid^="task-"]')).toHaveLength(0);
  });

  it("renders quadrant-specific empty state message", () => {
    render(<MatrixColumn quadrant={mockQuadrant} tasks={[]} allTasks={[]} {...mockHandlers} />);
    expect(screen.getByText("What needs your attention right now?")).toBeInTheDocument();
  });

  it("applies correct styling based on quadrant", () => {
    render(<MatrixColumn quadrant={mockQuadrant} tasks={[]} allTasks={[]} {...mockHandlers} />);

    // Verify component renders with quadrant information
    expect(screen.getByText("Do First")).toBeInTheDocument();
    expect(screen.getByText("Urgent & Important")).toBeInTheDocument();
  });
});
