import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import { TaskDetailSheet } from "@/components/matrix-simplified/task-detail-sheet";
import type { TaskRecord } from "@/lib/types";

const task = {
  id: "t1",
  title: "Original title",
  description: "",
  urgent: true,
  important: true,
  quadrant: "urgent-important",
  completed: false,
  tags: [],
  subtasks: [],
  dependencies: [],
  recurrence: "none",
  notificationEnabled: false,
  notificationSent: false,
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
} as TaskRecord;

const ownsEntry = (): boolean =>
  (window.history.state as { gsdOverlay?: boolean } | null)?.gsdOverlay === true;

async function goBack(): Promise<void> {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function renderDrawer(onClose = vi.fn()) {
  const view = render(<EditDrawer open task={task} onClose={onClose} onSubmit={vi.fn()} />);
  await waitFor(() => expect(screen.getByTestId("edit-title")).toHaveFocus());
  return { ...view, onClose };
}

afterEach(async () => {
  // Let any deferred history cleanup finish before the next test.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});

describe("browser Back with an overlay open", () => {
  it("holds one history entry while the drawer is open", async () => {
    const { unmount } = await renderDrawer();
    expect(ownsEntry()).toBe(true);
    unmount();
  });

  it("closes a clean drawer instead of leaving the page", async () => {
    const { onClose } = await renderDrawer();
    await goBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding when the draft has changes, and stays open", async () => {
    const user = userEvent.setup();
    const { onClose, unmount } = await renderDrawer();
    await user.type(screen.getByTestId("edit-description"), "unsaved words");
    await goBack();

    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(ownsEntry()).toBe(true);
    unmount();
  });

  it("gives the entry back when the drawer closes another way", async () => {
    const user = userEvent.setup();
    const { rerender } = await renderDrawer();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    rerender(<EditDrawer open={false} task={task} onClose={vi.fn()} onSubmit={vi.fn()} />);
    await waitFor(() => expect(ownsEntry()).toBe(false));
  });

  it("closes the details sheet on Back", async () => {
    const onClose = vi.fn();
    render(<TaskDetailSheet open task={task} onClose={onClose} onEdit={vi.fn()} />);
    expect(ownsEntry()).toBe(true);
    await goBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("leaving the page with unsaved drawer changes", () => {
  const fireBeforeUnload = (): Event => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  it("warns on reload or tab close when the draft is dirty", async () => {
    const user = userEvent.setup();
    const { unmount } = await renderDrawer();
    await user.type(screen.getByTestId("edit-description"), "unsaved words");
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    unmount();
  });

  it("stays quiet when nothing changed", async () => {
    const { unmount } = await renderDrawer();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
    unmount();
  });
});

describe("browser Forward after an overlay closed", () => {
  // Forward after Back used to land on the overlay's old entry with nothing
  // open, so the next Back went nowhere.
  it("steps past a stale overlay entry that Forward lands on", async () => {
    const { unmount } = await renderDrawer();
    unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(ownsEntry()).toBe(false);

    await act(async () => {
      window.history.forward();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });

    expect(ownsEntry()).toBe(false);
  });
});
