import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import { changedDraftFields } from "@/components/matrix-simplified/use-edit-draft-state";
import type { EditDraft } from "@/components/matrix-simplified/edit-draft";
import { SNOOZE_PRESETS } from "@/lib/snooze-presets";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "Call the plumber",
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
  createdAt: "2026-04-20T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
} as TaskRecord;

// "Now" is Monday, April 27, 2026 at noon.
const NOW = new Date(2026, 3, 27, 12, 0);

describe("<EditDrawer> snooze", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  });
  afterEach(() => vi.useRealTimers());

  function open(task: Partial<TaskRecord> | null = {}) {
    const onSubmit = vi.fn();
    render(
      <EditDrawer open task={task ? { ...baseTask, ...task } : null} onClose={vi.fn()} onSubmit={onSubmit} />
    );
    return onSubmit;
  }

  it("offers the native presets and says the task is not snoozed", () => {
    open();
    const group = screen.getByRole("group", { name: "Snooze" });
    expect(group).toHaveTextContent("Not snoozed");
    for (const preset of SNOOZE_PRESETS) {
      expect(screen.getByTestId(`edit-snooze-${preset.label}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("edit-snooze-clear")).toBeNull();
  });

  it("is absent when creating a task and on a completed task", () => {
    open(null);
    expect(screen.queryByRole("group", { name: "Snooze" })).toBeNull();
  });

  it("is absent on a completed task", () => {
    open({ completed: true });
    expect(screen.queryByRole("group", { name: "Snooze" })).toBeNull();
  });

  it("shows when the snooze ends after picking a preset, and saves only that change", async () => {
    const onSubmit = open();
    await user.click(screen.getByTestId("edit-snooze-3 hours"));
    expect(screen.getByRole("group", { name: "Snooze" })).toHaveTextContent(/Snoozed until .*3:00 PM/);

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    const [, , changed] = onSubmit.mock.calls[0] as [EditDraft, string, Partial<EditDraft>];
    expect(changed).toEqual({ snoozedUntil: new Date(2026, 3, 27, 15, 0).toISOString() });
  });

  it("clears an active snooze and saves the clear", async () => {
    const until = new Date(2026, 3, 27, 18, 0).toISOString();
    const onSubmit = open({ snoozedUntil: until });
    expect(screen.getByRole("group", { name: "Snooze" })).toHaveTextContent(/Snoozed until .*6:00 PM/);

    await user.click(screen.getByTestId("edit-snooze-clear"));
    expect(screen.getByRole("group", { name: "Snooze" })).toHaveTextContent("Not snoozed");

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    const [, , changed] = onSubmit.mock.calls[0] as [EditDraft, string, Partial<EditDraft>];
    expect("snoozedUntil" in changed).toBe(true);
    expect(changed.snoozedUntil).toBeUndefined();
  });

  it("treats a snooze that has already lapsed as not snoozed", () => {
    open({ snoozedUntil: new Date(2026, 3, 27, 9, 0).toISOString() });
    expect(screen.getByRole("group", { name: "Snooze" })).toHaveTextContent("Not snoozed");
    expect(screen.queryByTestId("edit-snooze-clear")).toBeNull();
  });

  it("leaves a snooze alone when the drawer does not touch it", async () => {
    const onSubmit = open({ snoozedUntil: new Date(2026, 3, 27, 18, 0).toISOString() });
    await user.type(screen.getByTestId("edit-description"), "ring twice");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    const [, , changed] = onSubmit.mock.calls[0] as [EditDraft, string, Partial<EditDraft>];
    expect("snoozedUntil" in changed).toBe(false);
  });
});

describe("changedDraftFields and a cleared optional field", () => {
  const start = { title: "a", snoozedUntil: "2026-04-27T18:00:00.000Z" } as unknown as EditDraft;

  it("reports a key that disappeared from the current draft as cleared", () => {
    const current = { title: "a" } as unknown as EditDraft;
    const changed = changedDraftFields(start, current);
    expect("snoozedUntil" in changed).toBe(true);
    expect(changed.snoozedUntil).toBeUndefined();
  });
});

describe("snooze chip accessible names", () => {
  it("stay distinct from the due-date presets that share their words", () => {
    render(<EditDrawer open task={baseTask} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Snooze next week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snooze tomorrow" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^next week$/i })).toHaveLength(1);
  });
});
