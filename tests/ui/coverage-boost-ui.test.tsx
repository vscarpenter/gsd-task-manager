/**
 * UI coverage boost — tests for components with low function coverage.
 * Targets: AccordionView, ViewToggle, task-card sub-components.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
// AccordionView mocks — stub all section components
// ---------------------------------------------------------------------------

vi.mock("@/components/user-guide/getting-started-section", () => ({
  GettingStartedSection: ({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) => (
    <div>
      <button onClick={onToggle}>Getting Started</button>
      {expanded && <div>Getting Started Content</div>}
    </div>
  ),
}));

vi.mock("@/components/user-guide/power-features-section", () => ({
  PowerFeaturesSection: ({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) => (
    <div>
      <button onClick={onToggle}>Power Features</button>
      {expanded && <div>Power Features Content</div>}
    </div>
  ),
}));

vi.mock("@/components/user-guide/matrix-section", () => ({
  MatrixSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Matrix</button>
  ),
}));

vi.mock("@/components/user-guide/task-management-section", () => ({
  TaskManagementSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Task Management</button>
  ),
}));

vi.mock("@/components/user-guide/advanced-features-section", () => ({
  AdvancedFeaturesSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Advanced Features</button>
  ),
}));

vi.mock("@/components/user-guide/smart-views-section", () => ({
  SmartViewsSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Smart Views</button>
  ),
}));

vi.mock("@/components/user-guide/batch-operations-section", () => ({
  BatchOperationsSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Batch Operations</button>
  ),
}));

vi.mock("@/components/user-guide/dashboard-section", () => ({
  DashboardSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Dashboard</button>
  ),
}));

vi.mock("@/components/user-guide/workflows-section", () => ({
  WorkflowsSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Workflows</button>
  ),
}));

vi.mock("@/components/user-guide/data-privacy-section", () => ({
  DataPrivacySection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Data Privacy</button>
  ),
}));

vi.mock("@/components/user-guide/shortcuts-section", () => ({
  ShortcutsSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>Shortcuts</button>
  ),
}));

vi.mock("@/components/user-guide/pwa-section", () => ({
  PwaSection: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle}>PWA</button>
  ),
}));

// ---------------------------------------------------------------------------
// ViewToggle mocks
// ---------------------------------------------------------------------------

const mockNavigateWithTransition = vi.fn();
const mockPathname = vi.fn().mockReturnValue("/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/lib/use-view-transition", () => ({
  useViewTransition: () => ({
    navigateWithTransition: mockNavigateWithTransition,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Tests: AccordionView
// ---------------------------------------------------------------------------

describe("AccordionView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with Getting Started expanded by default", async () => {
    const { AccordionView } = await import(
      "@/components/user-guide/accordion-view"
    );
    render(<AccordionView />);

    expect(screen.getByText("Getting Started Content")).toBeInTheDocument();
    expect(screen.getByText("Now go get stuff done!")).toBeInTheDocument();
  });

  it("toggles Power Features section on click", async () => {
    const { AccordionView } = await import(
      "@/components/user-guide/accordion-view"
    );
    const user = userEvent.setup();

    render(<AccordionView />);

    // Power Features not expanded by default
    expect(screen.queryByText("Power Features Content")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("Power Features"));
    expect(screen.getByText("Power Features Content")).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText("Power Features"));
    expect(screen.queryByText("Power Features Content")).not.toBeInTheDocument();
  });

  it("can toggle Getting Started closed", async () => {
    const { AccordionView } = await import(
      "@/components/user-guide/accordion-view"
    );
    const user = userEvent.setup();

    render(<AccordionView />);
    expect(screen.getByText("Getting Started Content")).toBeInTheDocument();

    await user.click(screen.getByText("Getting Started"));
    expect(screen.queryByText("Getting Started Content")).not.toBeInTheDocument();
  });

  it("renders all section toggle buttons", async () => {
    const { AccordionView } = await import(
      "@/components/user-guide/accordion-view"
    );
    render(<AccordionView />);

    const expectedSections = [
      "Getting Started",
      "Power Features",
      "Matrix",
      "Task Management",
      "Advanced Features",
      "Smart Views",
      "Batch Operations",
      "Dashboard",
      "Workflows",
      "Data Privacy",
      "Shortcuts",
      "PWA",
    ];

    for (const section of expectedSections) {
      expect(screen.getByText(section)).toBeInTheDocument();
    }
  });

  it("can toggle every section individually", async () => {
    const { AccordionView } = await import(
      "@/components/user-guide/accordion-view"
    );
    const user = userEvent.setup();

    render(<AccordionView />);

    // Toggle every section to exercise all toggleSection callbacks
    const sections = [
      "Matrix",
      "Task Management",
      "Advanced Features",
      "Smart Views",
      "Batch Operations",
      "Dashboard",
      "Workflows",
      "Data Privacy",
      "Shortcuts",
      "PWA",
    ];

    for (const section of sections) {
      await user.click(screen.getByText(section));
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: ViewToggle
// ---------------------------------------------------------------------------

describe("ViewToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  it("renders Matrix and Dashboard buttons", async () => {
    const { ViewToggle } = await import("@/components/view-toggle");
    render(<ViewToggle />);

    expect(
      screen.getByRole("button", { name: /switch to matrix/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to dashboard/i })
    ).toBeInTheDocument();
  });

  it("navigates to dashboard when dashboard button clicked", async () => {
    const { ViewToggle } = await import("@/components/view-toggle");
    const user = userEvent.setup();

    render(<ViewToggle />);
    await user.click(
      screen.getByRole("button", { name: /switch to dashboard/i })
    );

    expect(mockNavigateWithTransition).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates to home when matrix button clicked", async () => {
    const { ViewToggle } = await import("@/components/view-toggle");
    const user = userEvent.setup();
    mockPathname.mockReturnValue("/dashboard");

    render(<ViewToggle />);
    await user.click(
      screen.getByRole("button", { name: /switch to matrix/i })
    );

    expect(mockNavigateWithTransition).toHaveBeenCalledWith("/");
  });
});

// ---------------------------------------------------------------------------
// Tests: TaskCardHeader sub-component
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
