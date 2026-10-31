import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Resolves on the next popstate. jsdom traverses history asynchronously, so a fixed sleep races under load. */
const nextPopState = () =>
  new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));

async function goBack(): Promise<void> {
  await act(async () => {
    const popped = nextPopState();
    window.history.back();
    await popped;
    await nextTask();
  });
}

/**
 * Unmount, run the hook's deferred release, and wait for its history.back() to
 * land. The hook keeps module-level state (ignoreNextPop), so a test must not
 * start while the previous one's popstate is still in flight.
 */
async function settleHistory(): Promise<void> {
  cleanup();
  await act(async () => {
    await nextTask();
  });
  await waitFor(() => expect(ownsEntry()).toBe(false));
}

async function renderDrawer(onClose = vi.fn()) {
  const view = render(<EditDrawer open task={task} onClose={onClose} onSubmit={vi.fn()} />);
  await waitFor(() => expect(screen.getByTestId("edit-title")).toHaveFocus());
  return { ...view, onClose };
}

afterEach(settleHistory);

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
    await renderDrawer();
    await settleHistory();
    expect(ownsEntry()).toBe(false);

    await act(async () => {
      const landed = nextPopState();
      window.history.forward();
      await landed;
      // Forward really did land on the stale overlay entry; without this the
      // final assertion would also pass when nothing happened at all.
      expect(ownsEntry()).toBe(true);
      await nextPopState();
    });

    expect(ownsEntry()).toBe(false);
  });
});
