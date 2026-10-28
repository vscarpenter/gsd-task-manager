import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditDrawer } from "@/components/matrix-simplified/edit-drawer";
import type { TaskRecord } from "@/lib/types";

const baseTask = {
  id: "t1",
  title: "Draft the proposal",
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

// Local-time constructors keep these cases true in any time zone.
// "Now" is Monday, April 27, 2026 at noon: This week = Fri May 1, Next week = Mon May 4.
const NOW = new Date(2026, 3, 27, 12, 0);
const localIso = (month: number, day: number, hour = 0, minute = 0): string =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

describe("<EditDrawer> due date round trip", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    user = userEvent.setup();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function openTask(dueDate: string) {
    const onSubmit = vi.fn();
    render(<EditDrawer open task={{ ...baseTask, dueDate }} onClose={vi.fn()} onSubmit={onSubmit} />);
    return onSubmit;
  }

  async function saveAndReadDueDate(onSubmit: ReturnType<typeof vi.fn>): Promise<string | undefined> {
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    const [draft] = onSubmit.mock.calls[0] as [{ dueDate?: string }];
    return draft.dueDate;
  }

  it("keeps a date three days out instead of moving it to Friday", async () => {
    const stored = localIso(4, 30);
    const onSubmit = openTask(stored);

    expect(await saveAndReadDueDate(onSubmit)).toBe(stored);
  });

  it("keeps a date ten days out instead of moving it to next Monday", async () => {
    const stored = localIso(5, 7);
    const onSubmit = openTask(stored);

    expect(await saveAndReadDueDate(onSubmit)).toBe(stored);
  });

  it("keeps the time of day on a date within the next week", async () => {
    const stored = localIso(4, 29, 14, 30);
    const onSubmit = openTask(stored);

    expect(await saveAndReadDueDate(onSubmit)).toBe(stored);
  });

  it("keeps the time of day on a date weeks away", async () => {
    const stored = localIso(5, 20, 14, 30);
    const onSubmit = openTask(stored);

    expect(await saveAndReadDueDate(onSubmit)).toBe(stored);
  });

  it("keeps the time of day when the user re-picks the preset the date already matches", async () => {
    const stored = localIso(5, 1, 14, 30);
    const onSubmit = openTask(stored);

    await user.click(screen.getByRole("button", { name: /^this week$/i }));

    expect(await saveAndReadDueDate(onSubmit)).toBe(stored);
  });

  it("shows a date that matches no preset as its own date", () => {
    openTask(localIso(4, 30));

    expect(screen.getByRole("button", { name: /clear custom date/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^this week$/i })).toHaveAttribute("aria-pressed", "false");
  });

  // "Mon, Jan 1" hid a mistyped 1900, the one detail that explains it.
  it("adds the year to a picked date outside this year", () => {
    openTask(new Date(1900, 0, 1, 12).toISOString());
    expect(screen.getByText(/Jan 1, 1900/)).toBeInTheDocument();
  });

  it("selects This week for a date on this Friday", () => {
    openTask(localIso(5, 1));

    expect(screen.getByRole("button", { name: /^this week$/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("reads Today from the local calendar day, not the UTC one", () => {
    // Late evening: in time zones west of UTC the UTC date has already rolled over.
    vi.setSystemTime(new Date(2026, 3, 27, 23, 30));
    openTask(localIso(4, 28));

    expect(screen.getByRole("button", { name: /^today$/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("moves the date when the user picks a different preset", async () => {
    const onSubmit = openTask(localIso(4, 30));

    await user.click(screen.getByRole("button", { name: /^next week$/i }));

    expect(await saveAndReadDueDate(onSubmit)).toBe(localIso(5, 4));
  });
});
