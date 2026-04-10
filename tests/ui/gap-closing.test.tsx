import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTask } from "@/tests/fixtures";

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

vi.mock("@/lib/tasks", () => ({
  hasRunningTimer: vi.fn(() => false),
  getRunningEntry: vi.fn(() => undefined),
  formatTimeSpent: vi.fn((m: number) => `${m}m`),
  isTaskSnoozed: vi.fn(() => false),
  getRemainingSnoozeMinutes: vi.fn(() => 0),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

// ---------------------------------------------------------------------------
// PwaUpdateToast tests
// ---------------------------------------------------------------------------

describe("PwaUpdateToast", () => {
  beforeEach(() => {
    // jsdom does not provide navigator.serviceWorker by default
    if (!("serviceWorker" in navigator)) {
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        configurable: true,
      });
    }
  });

  it("renders nothing when no update is available", async () => {
    const { PwaUpdateToast } = await import(
      "@/components/pwa-update-toast"
    );

    const { container } = render(<PwaUpdateToast />);

    expect(container.firstChild).toBeNull();
  });

  it("renders update toast when pwa-update-available fires", async () => {
    const { PwaUpdateToast } = await import(
      "@/components/pwa-update-toast"
    );

    render(<PwaUpdateToast />);

    // Simulate event
    const mockWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const event = new CustomEvent("pwa-update-available", {
      detail: mockWorker,
    });
    window.dispatchEvent(event);

    expect(await screen.findByText("Update Available")).toBeInTheDocument();
    expect(screen.getByText("Refresh Now")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
  });

  it("dismisses when Later is clicked", async () => {
    const { PwaUpdateToast } = await import(
      "@/components/pwa-update-toast"
    );
    const user = userEvent.setup();

    render(<PwaUpdateToast />);

    const mockWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    window.dispatchEvent(
      new CustomEvent("pwa-update-available", { detail: mockWorker })
    );

    await screen.findByText("Update Available");
    await user.click(screen.getByText("Later"));

    expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TaskTimer tests
// ---------------------------------------------------------------------------

describe("TaskTimer", () => {
  const baseProps = {
    task: createMockTask({ timeSpent: 30 }),
    onStartTimer: vi.fn().mockResolvedValue(undefined),
    onStopTimer: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders play button and tracked time when not running", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(<TaskTimer {...baseProps} />);

    expect(screen.getByLabelText(/start timer/i)).toBeInTheDocument();
  });

  it("renders compact variant with Track label for zero time", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(
      <TaskTimer
        {...baseProps}
        task={createMockTask({ timeSpent: 0 })}
        compact
      />
    );

    expect(screen.getByText("Track")).toBeInTheDocument();
  });

  it("renders compact variant with time when timeSpent > 0", async () => {
    const { TaskTimer } = await import("@/components/task-timer");

    render(<TaskTimer {...baseProps} compact />);

    expect(screen.getByText("30m")).toBeInTheDocument();
  });

  it("calls onStartTimer when play is clicked", async () => {
    const { TaskTimer } = await import("@/components/task-timer");
    const user = userEvent.setup();

    render(<TaskTimer {...baseProps} />);

    await user.click(screen.getByLabelText(/start timer/i));

    expect(baseProps.onStartTimer).toHaveBeenCalledWith("test-task-1");
  });
});

// ---------------------------------------------------------------------------
// SnoozeDropdown tests
// ---------------------------------------------------------------------------

describe("SnoozeDropdown", () => {
  const baseProps = {
    task: createMockTask(),
    onSnooze: vi.fn().mockResolvedValue(undefined),
  };

  it("renders the snooze trigger button", async () => {
    const { SnoozeDropdown } = await import("@/components/snooze-dropdown");

    render(<SnoozeDropdown {...baseProps} />);

    expect(
      screen.getByLabelText("Snooze notifications")
    ).toBeInTheDocument();
  });

  it("displays snooze duration options", async () => {
    const { SnoozeDropdown } = await import("@/components/snooze-dropdown");

    render(<SnoozeDropdown {...baseProps} />);

    expect(screen.getByText("15 minutes")).toBeInTheDocument();
    expect(screen.getByText("1 hour")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TagMultiselect tests
// ---------------------------------------------------------------------------

describe("TagMultiselect", () => {
  const baseProps = {
    availableTags: ["bug", "feature", "urgent"],
    selectedTags: [] as string[],
    onChange: vi.fn(),
  };

  it("renders available tags", async () => {
    const { TagMultiselect } = await import("@/components/tag-multiselect");

    render(<TagMultiselect {...baseProps} />);

    expect(screen.getByText("#bug")).toBeInTheDocument();
    expect(screen.getByText("#feature")).toBeInTheDocument();
    expect(screen.getByText("#urgent")).toBeInTheDocument();
  });

  it("shows 'No tags available' when list is empty", async () => {
    const { TagMultiselect } = await import("@/components/tag-multiselect");

    render(
      <TagMultiselect {...baseProps} availableTags={[]} />
    );

    expect(screen.getByText("No tags available")).toBeInTheDocument();
  });

  it("shows selected count and Clear all button", async () => {
    const { TagMultiselect } = await import("@/components/tag-multiselect");

    render(
      <TagMultiselect
        {...baseProps}
        selectedTags={["bug", "feature"]}
      />
    );

    expect(screen.getByText("Tags (2)")).toBeInTheDocument();
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("calls onChange when a tag is toggled", async () => {
    const { TagMultiselect } = await import("@/components/tag-multiselect");
    const user = userEvent.setup();

    render(<TagMultiselect {...baseProps} />);

    await user.click(screen.getByText("#bug"));

    expect(baseProps.onChange).toHaveBeenCalledWith(["bug"]);
  });
});
