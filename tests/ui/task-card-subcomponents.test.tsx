/**
 * Tests for the task-card sub-components (actions, header, metadata).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

// Fixed base timestamp so rendered task dates are deterministic (no `new Date()`
// "now" reaching JSX, which react-doctor flags as a hydration nondeterminism).
const NOW = new Date("2026-01-15T12:00:00Z");

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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        onToggleComplete={vi.fn()}
        sortableAttributes={{} as SortableAttributes}
        sortableListeners={undefined}
      />
    );

    const heading = container.querySelector("h3");
    expect(heading).toHaveClass("line-through");
  });

  it("does not animate when completion arrives without a local activation", async () => {
    const { TaskCardHeader } = await import(
      "@/components/task-card/task-card-header"
    );
    const task = {
      id: "external-completion",
      title: "Synced completion",
      description: "",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important" as const,
      completed: false,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    };
    const props = {
      onToggleComplete: vi.fn(),
      sortableAttributes: {} as SortableAttributes,
      sortableListeners: undefined,
    };
    const { container, rerender } = render(<TaskCardHeader task={task} {...props} />);

    rerender(<TaskCardHeader task={{ ...task, completed: true }} {...props} />);

    expect(container.querySelector(".animate-check-pop")).toBeNull();
  });

  it("animates after a successful local completion", async () => {
    const { TaskCardHeader } = await import(
      "@/components/task-card/task-card-header"
    );
    const user = userEvent.setup();
    const task = {
      id: "local-completion",
      title: "Local completion",
      description: "",
      urgent: false,
      important: true,
      quadrant: "not-urgent-important" as const,
      completed: false,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      recurrence: "none" as const,
      tags: [],
      subtasks: [],
      dependencies: [],
      notificationEnabled: true,
      notificationSent: false,
    };
    const onToggleComplete = vi.fn().mockResolvedValue(undefined);
    const props = {
      onToggleComplete,
      sortableAttributes: {} as SortableAttributes,
      sortableListeners: undefined,
    };
    const { container, rerender } = render(<TaskCardHeader task={task} {...props} />);

    await user.click(screen.getByRole("button", { name: "Mark as complete" }));
    rerender(<TaskCardHeader task={{ ...task, completed: true }} {...props} />);

    expect(container.querySelector(".animate-check-pop")).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector(".animate-check-pop")).toBeNull();
    });

    rerender(<TaskCardHeader task={task} {...props} />);
    rerender(<TaskCardHeader task={{ ...task, completed: true }} {...props} />);
    expect(container.querySelector(".animate-check-pop")).toBeNull();
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        overdueDays={0}
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        overdueDays={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onShare={vi.fn()}
        onDuplicate={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /share task/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /duplicate task/i })).toBeInTheDocument();
  });

  it("leads the footer row with the overdue chip", async () => {
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          recurrence: "none",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={true}
        taskIsDueToday={false}
        overdueDays={3}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // The overdue caption came back down from the card root into the footer,
    // where it shares a scan column with "Due today" and the relative date.
    // Without a dueDate the chip states the age alone rather than an em-dash.
    expect(screen.getByTestId("task-card-overdue-chip")).toHaveTextContent("3d overdue");
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
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          recurrence: "daily",
          tags: [],
          subtasks: [],
          dependencies: [],
          notificationEnabled: true,
          notificationSent: false,
        }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        overdueDays={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const recurIcon = container.querySelector('[title="Recurs daily"]');
    expect(recurIcon).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: snooze on the card (touch route and the visible result)
// ---------------------------------------------------------------------------

describe("TaskCardActions snooze", () => {
  const baseTask = {
    id: "t5",
    title: "Snooze Task",
    description: "",
    urgent: true,
    important: true,
    quadrant: "urgent-important" as const,
    completed: false,
    dueDate: "2026-01-20T09:00:00.000Z",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    recurrence: "none" as const,
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: true,
    notificationSent: false,
  };

  async function renderActions(overrides: Partial<typeof baseTask> = {}, onSnooze = vi.fn()) {
    const { TaskCardActions } = await import("@/components/task-card/task-card-actions");
    render(
      <TaskCardActions
        task={{ ...baseTask, ...overrides }}
        taskIsOverdue={false}
        taskIsDueToday={false}
        overdueDays={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSnooze={onSnooze}
      />
    );
    return onSnooze;
  }

  it("offers Snooze 1 hour in the mobile menu as the non-gesture route", async () => {
    const onSnooze = await renderActions();

    await userEvent.click(screen.getByRole("button", { name: "Snooze 1 hour" }));

    expect(onSnooze).toHaveBeenCalledWith("t5", 60);
  });

  it("drops the mobile snooze item once the task is done", async () => {
    await renderActions({ completed: true });

    expect(screen.queryByRole("button", { name: "Snooze 1 hour" })).toBeNull();
  });

  it("keeps the desktop hover cluster free of snooze", async () => {
    await renderActions();

    expect(screen.queryByRole("button", { name: /snooze notifications/i })).toBeNull();
    expect(screen.queryByTestId("snooze-task")).toBeNull();
  });

  it("shows how long a snoozed task stays quiet", async () => {
    const inFiftyMinutes = new Date(Date.now() + 50 * 60 * 1000).toISOString();
    await renderActions({ snoozedUntil: inFiftyMinutes });

    expect(screen.getByTestId("task-card-snoozed-chip")).toHaveTextContent("Snoozed 50m");
  });

  it("shows no chip once the snooze has lapsed", async () => {
    await renderActions({ snoozedUntil: "2026-01-01T00:00:00.000Z" });

    expect(screen.queryByTestId("task-card-snoozed-chip")).toBeNull();
  });
});
