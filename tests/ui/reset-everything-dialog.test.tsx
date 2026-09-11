import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
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
    onExport: vi.fn().mockResolvedValue(true),
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

  it("failed export does not unlock the reset button", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockResolvedValue(false); // export failed
    render(<ResetEverythingDialog {...baseProps} onExport={onExport} />);

    await user.click(screen.getByRole("switch", { name: /export my data first/i }));
    await user.type(screen.getByPlaceholderText("Type RESET here"), "RESET");
    await user.click(screen.getByRole("button", { name: /export now/i }));

    await waitFor(() => expect(onExport).toHaveBeenCalled());
    // gate stays closed: export-first is on but the backup failed
    expect(screen.getByRole("button", { name: /reset everything/i })).toBeDisabled();
  });

  it("successful export unlocks reset without a duplicate toast", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn().mockResolvedValue(true); // parent owns the success toast
    render(<ResetEverythingDialog {...baseProps} onExport={onExport} />);

    await user.click(screen.getByRole("switch", { name: /export my data first/i }));
    await user.type(screen.getByPlaceholderText("Type RESET here"), "RESET");
    await user.click(screen.getByRole("button", { name: /export now/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reset everything/i })).toBeEnabled(),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  describe("when reset fails", () => {
    async function resetWith(failure: { failedSteps: string[]; errors: string[] }) {
      const { resetEverything } = await import("@/lib/reset-everything");
      vi.mocked(resetEverything).mockResolvedValueOnce({
        success: false,
        clearedTables: [],
        clearedLocalStorage: [],
        ...failure,
      } as Awaited<ReturnType<typeof resetEverything>>);
      const user = userEvent.setup();
      render(<ResetEverythingDialog {...baseProps} />);
      await user.type(screen.getByPlaceholderText("Type RESET here"), "RESET");
      await user.click(screen.getByRole("button", { name: /reset everything/i }));
    }

    it("should_say_tasks_were_not_deleted_when_local_data_step_fails", async () => {
      await resetWith({
        failedSteps: ["sync-sign-out", "local-data"],
        errors: ["Sync logout: offline", "IndexedDB: blocked"],
      });

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Reset didn't finish. Your tasks were not deleted.", {
          description: "Sync logout: offline, IndexedDB: blocked",
        }),
      );
      expect(screen.getByRole("button", { name: /reset everything/i })).toBeEnabled();
      expect(baseProps.onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      ["sync-sign-out", "Sync logout: offline"],
      ["browser-storage", "localStorage theme: denied"],
    ])("should_say_tasks_were_deleted_when_only_browser_storage_or_sign_out_fails (%s)", async (step, detail) => {
      await resetWith({ failedSteps: [step], errors: [detail] });

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Your tasks were deleted, but reset didn't finish.", {
          description: detail,
        }),
      );
      expect(screen.getByRole("button", { name: /reset everything/i })).toBeEnabled();
      expect(baseProps.onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe("existing reset flows", () => {
    async function confirmAndReset(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByPlaceholderText("Type RESET here"), "RESET");
      await user.click(screen.getByRole("button", { name: /reset everything/i }));
    }

    it("should_toast_success_and_reload_after_a_clean_reset", async () => {
      const { reloadAfterReset } = await import("@/lib/reset-everything");
      const user = userEvent.setup();
      render(<ResetEverythingDialog {...baseProps} />);

      await confirmAndReset(user);

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Reset complete - reloading application..."),
      );
      await waitFor(() => expect(reloadAfterReset).toHaveBeenCalledTimes(1), { timeout: 3000 });
    });

    it("should_show_the_thrown_message_and_stay_open_when_reset_throws", async () => {
      const { resetEverything } = await import("@/lib/reset-everything");
      vi.mocked(resetEverything).mockRejectedValueOnce(new Error("IndexedDB unavailable"));
      const user = userEvent.setup();
      render(<ResetEverythingDialog {...baseProps} />);

      await confirmAndReset(user);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("IndexedDB unavailable"));
      expect(screen.getByRole("button", { name: /reset everything/i })).toBeEnabled();
    });

    it("should_clear_the_confirmation_and_close_when_cancel_is_clicked", async () => {
      const user = userEvent.setup();
      render(<ResetEverythingDialog {...baseProps} />);
      await user.type(screen.getByPlaceholderText("Type RESET here"), "RESET");

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.getByPlaceholderText("Type RESET here")).toHaveValue("");
    });

    it("should_reset_without_the_theme_when_preserve_theme_is_turned_off", async () => {
      const { resetEverything } = await import("@/lib/reset-everything");
      vi.mocked(resetEverything).mockResolvedValueOnce({
        success: false,
        clearedTables: [],
        clearedLocalStorage: [],
        errors: ["localStorage theme: denied"],
        failedSteps: ["browser-storage"],
      });
      const user = userEvent.setup();
      render(<ResetEverythingDialog {...baseProps} />);

      await user.click(screen.getByRole("switch", { name: /preserve my theme preference/i }));
      await confirmAndReset(user);

      expect(screen.queryByText(/your theme preference/i)).not.toBeInTheDocument();
      await waitFor(() => expect(resetEverything).toHaveBeenCalledWith({ preserveTheme: false }));
    });
  });
});
