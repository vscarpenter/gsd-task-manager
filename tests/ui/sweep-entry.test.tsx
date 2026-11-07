import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SweepEntry } from "@/components/weekly-sweep/sweep-entry";
import { SWEEP_LAST_SWEPT_KEY } from "@/lib/preferences/weekly-sweep";
import { createMockTask } from "@/tests/fixtures";

const NOW = new Date("2026-11-08T16:00:00.000Z");
const overdue = createMockTask({ id: "a", dueDate: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" });

describe("SweepEntry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    localStorage.removeItem(SWEEP_LAST_SWEPT_KEY);
  });
  afterEach(() => vi.useRealTimers());

  it("shows a quiet Weekly sweep link when never swept and there are cards", () => {
    render(<SweepEntry tasks={[overdue]} />);

    expect(screen.getByRole("link", { name: "Weekly sweep" })).toHaveAttribute("href", "/sweep");
  });

  it("hides when nothing needs a decision", () => {
    render(<SweepEntry tasks={[createMockTask({ id: "fresh", updatedAt: "2026-11-08T00:00:00.000Z" })]} />);

    expect(screen.queryByRole("link", { name: "Weekly sweep" })).toBeNull();
  });

  it("hides within seven local days of the last sweep", () => {
    localStorage.setItem(SWEEP_LAST_SWEPT_KEY, "2026-11-05T12:00:00.000Z");

    render(<SweepEntry tasks={[overdue]} />);

    expect(screen.queryByRole("link", { name: "Weekly sweep" })).toBeNull();
  });

  it("shows again after seven local days", () => {
    localStorage.setItem(SWEEP_LAST_SWEPT_KEY, "2026-10-30T12:00:00.000Z");

    render(<SweepEntry tasks={[overdue]} />);

    expect(screen.getByRole("link", { name: "Weekly sweep" })).toBeInTheDocument();
  });

  it("states no count", () => {
    render(<SweepEntry tasks={[overdue]} />);

    expect(document.body.textContent).not.toMatch(/\d/);
  });
});
