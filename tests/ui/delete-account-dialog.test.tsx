import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { deleteRemoteAccountAndTasks } from "@/lib/sync/pb-account-deletion";
import { resetEverything } from "@/lib/reset-everything";
import { disableSync } from "@/lib/sync/config";
import { toast } from "sonner";

vi.mock("@/lib/sync/pb-account-deletion", () => ({
  deleteRemoteAccountAndTasks: vi.fn(),
}));

vi.mock("@/lib/reset-everything", () => ({
  resetEverything: vi.fn().mockResolvedValue({
    success: true,
    clearedTables: [],
    clearedLocalStorage: [],
    errors: [],
  }),
  reloadAfterReset: vi.fn(),
}));

vi.mock("@/lib/sync/config", () => ({
  disableSync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe("DeleteAccountDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    onExport: vi.fn().mockResolvedValue(undefined),
    onDeleted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delete_button_disabled_until_DELETE_is_typed", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountDialog {...baseProps} />);

    const deleteBtn = screen.getByRole("button", { name: /^delete account$/i });
    expect(deleteBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Type DELETE here"), "DELETE");

    expect(deleteBtn).toBeEnabled();
  });

  it("erase_local_checked_calls_resetEverything_on_success", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteRemoteAccountAndTasks).mockResolvedValue({ ok: true, stage: "done" });
    render(<DeleteAccountDialog {...baseProps} />);

    await user.click(screen.getByRole("switch", { name: /erase all tasks/i }));
    await user.type(screen.getByPlaceholderText("Type DELETE here"), "DELETE");
    await user.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => expect(deleteRemoteAccountAndTasks).toHaveBeenCalled());
    expect(resetEverything).toHaveBeenCalledWith({ preserveTheme: true });
    expect(disableSync).not.toHaveBeenCalled();
  });

  it("keep_local_calls_disableSync_on_success", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteRemoteAccountAndTasks).mockResolvedValue({ ok: true, stage: "done" });
    render(<DeleteAccountDialog {...baseProps} />);

    await user.type(screen.getByPlaceholderText("Type DELETE here"), "DELETE");
    await user.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => expect(disableSync).toHaveBeenCalled());
    expect(resetEverything).not.toHaveBeenCalled();
    expect(baseProps.onDeleted).toHaveBeenCalled();
  });

  it("shows_error_toast_and_stays_open_on_remote_failure", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteRemoteAccountAndTasks).mockResolvedValue({
      ok: false,
      stage: "tasks",
      error: "network down",
    });
    render(<DeleteAccountDialog {...baseProps} />);

    await user.type(screen.getByPlaceholderText("Type DELETE here"), "DELETE");
    await user.click(screen.getByRole("button", { name: /^delete account$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(resetEverything).not.toHaveBeenCalled();
    expect(disableSync).not.toHaveBeenCalled();
    // dialog stays open
    expect(screen.getByRole("heading", { name: /delete account/i })).toBeInTheDocument();
  });
});
