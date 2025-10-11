import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "@/components/task-card";
import type { TaskRecord } from "@/lib/types";

// Mock dnd-kit
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => ""
    }
  }
}));

describe("TaskCard", () => {
  const mockTask: TaskRecord = {
    id: "task-1",
    title: "Test Task",
    description: "Test description",
    urgent: true,
    important: true,
    quadrant: "urgent-important",
    completed: false,
    dueDate: undefined,
    recurrence: "none",
    tags: [],
    subtasks: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  };

  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleComplete: vi.fn()
  };

  it("renders task title and description", () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);

    expect(screen.getByText("Test Task")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("calls onToggleComplete when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={mockTask} {...mockHandlers} />);

    const checkbox = screen.getByRole("button", { name: /mark as complete/i });
    await user.click(checkbox);

    expect(mockHandlers.onToggleComplete).toHaveBeenCalledWith(mockTask, true);
  });

  it("calls onEdit when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={mockTask} {...mockHandlers} />);

    const editButton = screen.getByRole("button", { name: /edit task/i });
    await user.click(editButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockTask);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={mockTask} {...mockHandlers} />);

    const deleteButton = screen.getByRole("button", { name: /delete task/i });
    await user.click(deleteButton);

    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockTask);
  });

  it("renders with reduced opacity when completed", () => {
    const completedTask = { ...mockTask, completed: true };
    const { container } = render(<TaskCard task={completedTask} {...mockHandlers} />);

    const article = container.querySelector("article");
    expect(article).toHaveClass("opacity-60");
  });

  it("displays tags when present", () => {
    const taskWithTags = { ...mockTask, tags: ["work", "urgent"] };
    render(<TaskCard task={taskWithTags} {...mockHandlers} />);

    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("displays subtasks progress bar", () => {
    const taskWithSubtasks = {
      ...mockTask,
      subtasks: [
        { id: "sub-1", title: "Subtask 1", completed: true },
        { id: "sub-2", title: "Subtask 2", completed: false },
        { id: "sub-3", title: "Subtask 3", completed: true }
      ]
    };
    render(<TaskCard task={taskWithSubtasks} {...mockHandlers} />);

    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("displays overdue warning for past due dates", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueTask = { ...mockTask, dueDate: yesterday.toISOString() };

    render(<TaskCard task={overdueTask} {...mockHandlers} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("displays due today alert for today's due date", () => {
    const today = new Date();
    const todayTask = { ...mockTask, dueDate: today.toISOString() };

    render(<TaskCard task={todayTask} {...mockHandlers} />);

    expect(screen.getByText("Due today")).toBeInTheDocument();
  });

  it("displays recurrence icon for recurring tasks", () => {
    const recurringTask = { ...mockTask, recurrence: "daily" as const };
    const { container } = render(<TaskCard task={recurringTask} {...mockHandlers} />);

    // Look for the repeat icon (RepeatIcon from lucide-react)
    const repeatIcon = container.querySelector('[title="Recurs daily"]');
    expect(repeatIcon).toBeInTheDocument();
  });

  it("applies red border styling for overdue tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueTask = { ...mockTask, dueDate: yesterday.toISOString() };
    const { container } = render(<TaskCard task={overdueTask} {...mockHandlers} />);

    const article = container.querySelector("article");
    expect(article).toHaveClass("border-red-300");
  });

  it("does not show overdue warning for completed tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const completedOverdueTask = {
      ...mockTask,
      dueDate: yesterday.toISOString(),
      completed: true
    };

    render(<TaskCard task={completedOverdueTask} {...mockHandlers} />);

    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });

  it("renders without description when not provided", () => {
    const taskWithoutDescription = { ...mockTask, description: "" };
    render(<TaskCard task={taskWithoutDescription} {...mockHandlers} />);

    expect(screen.getByText("Test Task")).toBeInTheDocument();
    expect(screen.queryByText("Test description")).not.toBeInTheDocument();
  });

  it("displays 'No due date' when dueDate is undefined", () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);

    expect(screen.getByText(/due no due date/i)).toBeInTheDocument();
  });
});
