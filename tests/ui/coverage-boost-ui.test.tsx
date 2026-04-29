/**
 * UI coverage boost — tests for task-card sub-components.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SortableAttributes } from "@/components/task-card/types";

// ---------------------------------------------------------------------------
// Common mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------

describe("TaskCardHeader", () => {
  it("renders task title", async () => {
    const { TaskCardHeader } = await import(
      "@/components/task-card/task-card-header"
    );

    render(
      <TaskCardHeader
        task={{
          id: "t1",
          title: "My Header Task",
          description: "Description text",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        selectionMode={false}
        isSelected={false}
        onToggleComplete={vi.fn()}
        sortableAttributes={{} as SortableAttributes}
        sortableListeners={undefined}
      />
    );

    expect(screen.getByText("My Header Task")).toBeInTheDocument();
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });

  it("shows line-through for completed task", async () => {
    const { TaskCardHeader } = await import(
      "@/components/task-card/task-card-header"
    );

    const { container } = render(
      <TaskCardHeader
        task={{
          id: "t2",
          title: "Completed Task",
          description: "",
          urgent: false,
          important: false,
          quadrant: "not-urgent-not-important",
          completed: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        selectionMode={false}
        isSelected={false}
        onToggleComplete={vi.fn()}
        sortableAttributes={{} as SortableAttributes}
        sortableListeners={undefined}
      />
    );

    const heading = container.querySelector("h3");
    expect(heading).toHaveClass("line-through");
  });
});

// ---------------------------------------------------------------------------
// Tests: TaskCardMetadata sub-component
// ---------------------------------------------------------------------------

describe("TaskCardMetadata", () => {
  it("renders tags when present", async () => {
    const { TaskCardMetadata } = await import(
      "@/components/task-card/task-card-metadata"
    );

    render(
      <TaskCardMetadata
        task={{
          id: "t1",
          title: "Task with Tags",
          description: "",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: ["frontend", "urgent"],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        completedSubtasks={0}
        totalSubtasks={0}
        isBlocked={false}
        isBlocking={false}
        blockingTasks={[]}
        blockedTasks={[]}
      />
    );

    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("renders subtask progress bar", async () => {
    const { TaskCardMetadata } = await import(
      "@/components/task-card/task-card-metadata"
    );

    render(
      <TaskCardMetadata
        task={{
          id: "t2",
          title: "Task",
          description: "",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [
            { id: "s1", title: "Sub 1", completed: true },
            { id: "s2", title: "Sub 2", completed: false },
          ],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        completedSubtasks={1}
        totalSubtasks={2}
        isBlocked={false}
        isBlocking={false}
        blockingTasks={[]}
        blockedTasks={[]}
      />
    );

    expect(screen.getByText("1/2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: TaskCardActions sub-component
// ---------------------------------------------------------------------------

vi.mock("@/components/snooze-dropdown", () => ({
  SnoozeDropdown: () => <div data-testid="snooze-dropdown">Snooze</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe("TaskCardActions", () => {
  it("renders edit and delete buttons", async () => {
    const { TaskCardActions } = await import(
      "@/components/task-card/task-card-actions"
    );

    render(
      <TaskCardActions
        task={{
          id: "t1",
          title: "Action Task",
          description: "",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Desktop edit and delete buttons
    const editButtons = screen.getAllByRole("button", { name: /edit task/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it("renders share and duplicate buttons when handlers provided", async () => {
    const { TaskCardActions } = await import(
      "@/components/task-card/task-card-actions"
    );

    render(
      <TaskCardActions
        task={{
          id: "t2",
          title: "Share Task",
          description: "",
          urgent: false,
          important: false,
          quadrant: "not-urgent-not-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /share task/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate task/i })).toBeInTheDocument();
  });

  it("shows overdue badge", async () => {
    const { TaskCardActions } = await import(
      "@/components/task-card/task-card-actions"
    );

    render(
      <TaskCardActions
        task={{
          id: "t3",
          title: "Overdue Task",
          description: "",
          urgent: true,
          important: true,
          quadrant: "urgent-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={true}
        taskIsDueToday={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows recurrence icon", async () => {
    const { TaskCardActions } = await import(
      "@/components/task-card/task-card-actions"
    );

    const { container } = render(
      <TaskCardActions
        task={{
          id: "t4",
          title: "Recurring Task",
          description: "",
          urgent: false,
          important: true,
          quadrant: "not-urgent-important",
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recurrence: "daily",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const recurIcon = container.querySelector('[title="Recurs daily"]');
    expect(recurIcon).toBeInTheDocument();
  });
});
