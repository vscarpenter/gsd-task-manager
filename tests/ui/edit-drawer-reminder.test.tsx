import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import { getDb } from "@/lib/db";
import type { TaskRecord } from "@/lib/types";

/**
 * Per-task reminders.
 *
 * `notifyBefore` and `notificationEnabled` have always been in the schema, the sync wire
 * model, and the notification checker — but nothing in the app wrote them, so a reminder
 * set on the iOS client was invisible and uneditable here, and a web user could only
 * change the global default.
 */
const baseTask = {
  id: "t1",
  title: "Renew the domain",
  description: "",
  urgent: false,
  important: true,
  quadrant: "not-urgent-important",
  completed: false,
  recurrence: "none",
  tags: [],
  subtasks: [],
  dependencies: [],
  notificationEnabled: false,
  notificationSent: false,
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
} as TaskRecord;

describe("<EditDrawer> reminder", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  it("renders a reminder control", () => {
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("group", { name: /reminder/i })).toBeInTheDocument();
  });

  it("offers the same presets as the notification settings", () => {
    // 15 / 30 / 60 / 120 / 1440 — the canonical set, matching Settings and the iOS
    // client's NotificationSettings.allowedReminders.
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={vi.fn()} />);
    for (const label of ["Off", "15m", "30m", "1h", "2h", "1 day"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("submits the chosen reminder", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "2h" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notifyBefore: 120, notificationEnabled: true }),
      "t1"
    );
  });

  it("submits notificationEnabled false when set to Off", async () => {
    const onSubmit = vi.fn();
    render(
      <EditDrawer
        open
        task={{ ...baseTask, notifyBefore: 30, notificationEnabled: true }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: "Off" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notificationEnabled: false }),
      "t1"
    );
  });

  it("seeds from the task being edited", () => {
    render(
      <EditDrawer
        open
        task={{ ...baseTask, notifyBefore: 60, notificationEnabled: true }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "1h" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows Off for a task with reminders disabled", () => {
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders an off-list value from the iOS client rather than snapping it", () => {
    // The iOS editor additionally offers 0 / 5 minutes. A web user editing that task must
    // not silently rewrite their choice just because this control does not list it.
    render(
      <EditDrawer
        open
        task={{ ...baseTask, notifyBefore: 5, notificationEnabled: true }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "5m" })).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves an off-list value through a save that does not touch it", async () => {
    const onSubmit = vi.fn();
    render(
      <EditDrawer
        open
        task={{ ...baseTask, notifyBefore: 5, notificationEnabled: true }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notifyBefore: 5, notificationEnabled: true }),
      "t1"
    );
  });

  describe("a task that follows the default reminder", () => {
    // Reminders on with no offset of its own: what the capture bar creates. The notification
    // checker fires it at the default from Settings, so the editor must show that and leave
    // it alone. It used to read Off, and any save turned the reminder off.
    const followsDefault = { ...baseTask, notificationEnabled: true, notifyBefore: undefined };

    beforeEach(async () => {
      await getDb().notificationSettings.clear();
    });

    it("shows the built-in default when Settings has none stored", () => {
      render(<EditDrawer open task={followsDefault} onClose={vi.fn()} onSubmit={vi.fn()} />);

      expect(screen.getByRole("button", { name: "15m" })).toHaveAttribute("aria-pressed", "true");
    });

    it("shows the default reminder chosen in Settings", async () => {
      await getDb().notificationSettings.put({
        id: "settings",
        enabled: true,
        defaultReminder: 60,
        soundEnabled: true,
        permissionAsked: false,
        updatedAt: "2026-04-26T00:00:00.000Z",
      });

      render(<EditDrawer open task={followsDefault} onClose={vi.fn()} onSubmit={vi.fn()} />);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "1h" })).toHaveAttribute("aria-pressed", "true")
      );
    });

    it("keeps the reminder on and following the default when saved untouched", async () => {
      const onSubmit = vi.fn();
      render(<EditDrawer open task={followsDefault} onClose={vi.fn()} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: /save changes/i }));

      const [draft] = onSubmit.mock.calls[0] as [Record<string, unknown>];
      expect(draft).toMatchObject({ notificationEnabled: true, notifyBefore: undefined });
    });
  });

  it("keeps a disabled reminder's stored offset when saved untouched", async () => {
    const onSubmit = vi.fn();
    render(
      <EditDrawer
        open
        task={{ ...baseTask, notifyBefore: 30, notificationEnabled: false }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notifyBefore: 30, notificationEnabled: false }),
      "t1"
    );
  });

  it("defaults a new task to no per-task reminder", async () => {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={null} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "Something new");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notifyBefore: undefined, notificationEnabled: false }),
      undefined
    );
  });
});
