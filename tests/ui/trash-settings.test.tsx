import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getDb } from "@/lib/db";
import { TrashSettings } from "@/components/settings/trash-settings";
import { createMockTask } from "@/tests/fixtures";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("<TrashSettings>", () => {
  beforeEach(async () => {
    await getDb().deletedTasks.clear();
    await getDb().tasks.clear();
  });

  it("tells the user the trash is empty when it is", async () => {
    render(<TrashSettings />);
    await waitFor(() => expect(screen.getByText(/trash is empty/i)).toBeInTheDocument());
  });

  it("lists deleted tasks with how long they have left", async () => {
    await getDb().deletedTasks.put({
      ...createMockTask({ id: "t1", title: "Deleted thing" }),
      deletedAt: daysAgo(2),
    });

    render(<TrashSettings />);

    await waitFor(() => expect(screen.getByText("Deleted thing")).toBeInTheDocument());
    // The countdown is the point: it is what makes the 30 days a promise
    // rather than a surprise.
    expect(screen.getByText(/28 days left/i)).toBeInTheDocument();
  });

  it("restores a task back to the board", async () => {
    const user = userEvent.setup();
    await getDb().deletedTasks.put({
      ...createMockTask({ id: "t1", title: "Bring me back" }),
      deletedAt: daysAgo(1),
    });

    render(<TrashSettings />);
    await waitFor(() => expect(screen.getByText("Bring me back")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /restore Bring me back/i }));

    await waitFor(async () => {
      expect(await getDb().tasks.get("t1")).toBeDefined();
    });
    expect(await getDb().deletedTasks.get("t1")).toBeUndefined();
  });

  it("empties the trash on confirmation", async () => {
    const user = userEvent.setup();
    await getDb().deletedTasks.bulkPut([
      { ...createMockTask({ id: "t1" }), deletedAt: daysAgo(1) },
      { ...createMockTask({ id: "t2" }), deletedAt: daysAgo(1) },
    ]);

    render(<TrashSettings />);
    await waitFor(() => expect(screen.getByRole("button", { name: /empty trash/i })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: /empty trash/i }));
    // Permanent and irreversible, so it asks first.
    await user.click(await screen.findByRole("button", { name: /delete 2 tasks forever/i }));

    await waitFor(async () => {
      expect(await getDb().deletedTasks.count()).toBe(0);
    });
  });

  it("states the retention window so the rule is not a secret", async () => {
    render(<TrashSettings />);
    await waitFor(() =>
      expect(
        screen.getByText(/deleted tasks are kept for 30 days/i)
      ).toBeInTheDocument()
    );
  });
});
