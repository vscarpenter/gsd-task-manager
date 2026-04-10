import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetEverythingDialog } from "@/components/reset-everything-dialog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/reset-everything", () => ({
  resetEverything: vi.fn().mockResolvedValue({
    success: true,
    clearedTables: [],
    clearedLocalStorage: [],
    errors: [],
  }),
  reloadAfterReset: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResetEverythingDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onExport: vi.fn().mockResolvedValue(undefined),
    activeTasks: 5,
    completedTasks: 3,
    syncEnabled: false,
    pendingSync: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with title and description when open", () => {
    render(<ResetEverythingDialog {...baseProps} />);

    // Title text appears in both heading and reset button — verify heading
    expect(screen.getByRole("heading", { name: /Reset Everything/ })).toBeInTheDocument();
    expect(
      screen.getByText(
        "This will permanently delete all your data. This action cannot be undone."
      )
    ).toBeInTheDocument();
  });

  it("shows data summary with correct task counts", () => {
    render(<ResetEverythingDialog {...baseProps} />);

    expect(
      screen.getByText(/8 tasks \(5 active, 3 completed\)/)
    ).toBeInTheDocument();
  });

  it("shows sync warning when syncEnabled and pending changes exist", () => {
    render(
      <ResetEverythingDialog
        {...baseProps}
        syncEnabled={true}
        pendingSync={2}
      />
    );

    expect(
      screen.getByText(/Cloud sync configuration/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 unsynchronized changes/)
    ).toBeInTheDocument();
  });

  it("disables reset button until RESET is typed", async () => {
    const user = userEvent.setup();
    render(<ResetEverythingDialog {...baseProps} />);

    const resetBtn = screen.getByRole("button", {
      name: /reset everything/i,
    });
    expect(resetBtn).toBeDisabled();

    const input = screen.getByPlaceholderText("Type RESET here");
    await user.type(input, "RESET");

    expect(resetBtn).toBeEnabled();
  });
});
