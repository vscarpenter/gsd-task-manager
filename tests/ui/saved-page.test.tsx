import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTask } from "@/tests/fixtures";
import type { TaskRecord } from "@/lib/types";
import { toast } from "sonner";
import SavedPage from "@/components/saved/saved-page";

const mocks = vi.hoisted(() => ({ saved: [] as TaskRecord[], loading: false, update: vi.fn(), returnItem: vi.fn(), remove: vi.fn(), restore: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/use-tasks", () => ({ useTasks: () => ({ saved: mocks.saved, isLoading: mocks.loading }) }));
vi.mock("@/components/matrix-simplified/app-shell", () => ({ AppShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock("@/lib/tasks", () => ({ updateTask: (...args: unknown[]) => mocks.update(...args), deleteTask: (...args: unknown[]) => mocks.remove(...args), restoreTask: (...args: unknown[]) => mocks.restore(...args) }));
vi.mock("@/lib/tasks/saved", () => ({ returnSavedTask: (...args: unknown[]) => mocks.returnItem(...args), saveTaskForLater: (...args: unknown[]) => mocks.save(...args) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.resetAllMocks(); mocks.loading = false;
  mocks.save.mockResolvedValue(undefined); mocks.restore.mockResolvedValue(undefined);
  mocks.saved = [createMockTask({ id: "saved-article", title: "Read an article", description: "https://example.com/article", savedAt: new Date().toISOString() })];
});
describe("Saved page", () => {
  it("distinguishes loading from empty and explains how to save", () => {
    mocks.saved = []; mocks.loading = true;
    const view = render(<SavedPage />);
    expect(screen.getByText("Loading saved items…")).toBeInTheDocument();
    expect(screen.queryByText("Keep it for later")).not.toBeInTheDocument();
    mocks.loading = false; view.rerender(<SavedPage />);
    expect(screen.getByText("Keep it for later")).toBeInTheDocument();
  });
  it("searches saved notes and distinguishes no matches", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.type(screen.getByRole("searchbox", { name: "Search saved items" }), "absent");
    expect(screen.getByText("No saved items match your search.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.getByRole("heading", { name: "Read an article" })).toBeInTheDocument();
  });
  it("edits a short annotation without dropping the existing link", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Edit notes" }));
    const field = screen.getByRole("textbox", { name: "Notes and links" });
    expect(field).toHaveValue("https://example.com/article");
    expect(field).toHaveAttribute("maxlength", "600");
    await user.type(field, " Useful for later.");
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("saved-article", { description: "https://example.com/article Useful for later." }));
  });
  it("returns to an explicitly chosen quadrant after reviewing the date", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Return to matrix" }));
    await user.selectOptions(screen.getByLabelText("Quadrant"), "not-urgent-important");
    await user.click(screen.getByRole("button", { name: "Add to matrix" }));
    await waitFor(() => expect(mocks.returnItem).toHaveBeenCalledWith("saved-article", "not-urgent-important", undefined));
  });
  it("keeps entered notes available after a failed save", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Storage unavailable"));
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Edit notes" }));
    await user.type(screen.getByLabelText("Notes and links"), " Keep me.");
    await user.click(screen.getByRole("button", { name: "Save notes" }));
    await waitFor(() => expect(screen.getByLabelText("Notes and links")).toHaveValue("https://example.com/article Keep me."));
  });
  it("preserves an unchanged due time when returning an item", async () => {
    mocks.saved[0].dueDate = "2026-10-30T16:30:00.000Z";
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Return to matrix" }));
    await user.click(screen.getByRole("button", { name: "Add to matrix" }));
    await waitFor(() => expect(mocks.returnItem).toHaveBeenCalledWith("saved-article", mocks.saved[0].quadrant, "2026-10-30T16:30:00.000Z"));
  });
  it("lets the user revise the due date before returning", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Return to matrix" }));
    await user.type(screen.getByLabelText("Due date (optional)"), "2026-10-30");
    await user.click(screen.getByRole("button", { name: "Add to matrix" }));
    await waitFor(() => expect(mocks.returnItem).toHaveBeenCalledWith("saved-article", mocks.saved[0].quadrant, expect.stringMatching(/^2026-10-30T/)));
  });
  it("keeps a failed return available for retry", async () => {
    mocks.returnItem.mockRejectedValueOnce(new Error("No storage"));
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Return to matrix" }));
    await user.click(screen.getByRole("button", { name: "Add to matrix" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't return this item to the matrix"));
    expect(screen.getByLabelText("Quadrant")).toBeInTheDocument();
  });
  it("can undo returning an item", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Return to matrix" }));
    await user.click(screen.getByRole("button", { name: "Add to matrix" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Returned to matrix", expect.anything()));
    undoToast("Returned to matrix");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("saved-article"));
  });
  it("deletes with an Undo that restores the full saved record", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Delete Read an article" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("saved-article"));
    undoToast("Item moved to Trash");
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith(mocks.saved[0]));
  });
  it("reports deletion failures without dropping the item", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("No storage"));
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Delete Read an article" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't delete this saved item"));
    expect(screen.getByRole("heading", { name: "Read an article" })).toBeInTheDocument();
  });
  it("cancels editing and returns keyboard focus to the notes action", async () => {
    const user = userEvent.setup(); render(<SavedPage />);
    await user.click(screen.getByRole("button", { name: "Edit notes" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit notes" })).toHaveFocus();
    expect(mocks.update).not.toHaveBeenCalled();
  });

});

function undoToast(message: string) {
  const options = vi.mocked(toast.success).mock.calls.find(([title]) => title === message)?.[1];
  (options?.action as { onClick: () => void }).onClick();
}
