import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixIntro } from "@/components/matrix-simplified/matrix-intro";

/**
 * The briefing is one row, not a two-column section: on a 13" laptop the old
 * display-size date plus the Schedule card cost ~190px before the first
 * task, which pushed the bottom two quadrant headers below the fold. These
 * assert the compact contract — the props themselves are unchanged.
 */
function renderIntro(overrides?: Partial<Parameters<typeof MatrixIntro>[0]>) {
  const onFocusSchedule = vi.fn();
  const result = render(
    <MatrixIntro
      dateLabel="Saturday, August 22"
      message="The overdue task sits in Do First."
      scheduleCount={4}
      onFocusSchedule={onFocusSchedule}
      {...overrides}
    />
  );
  return { onFocusSchedule, ...result };
}

describe("MatrixIntro — compact one-row briefing", () => {
  it("drops the date heading from display scale to h2", () => {
    renderIntro();
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.className).toContain("text-h2");
    expect(heading.className).not.toContain("text-display");
    expect(heading).toHaveTextContent("Saturday, August 22");
  });

  it("keeps the screen-reader prefix so the bare date still reads as a heading", () => {
    renderIntro();
    expect(screen.getByRole("heading", { level: 1, name: /today.s matrix/i })).toBeInTheDocument();
  });

  it("names the Schedule quadrant and its count in plain words", () => {
    renderIntro({ scheduleCount: 4 });
    expect(screen.getByRole("button", { name: /^schedule/i })).toHaveTextContent("Schedule · 4 tasks");
  });

  it("uses the singular for one task", () => {
    renderIntro({ scheduleCount: 1 });
    expect(screen.getByRole("button", { name: /^schedule/i })).toHaveTextContent("Schedule · 1 task");
  });

  it("says 'Schedule is empty' rather than a bare zero", () => {
    renderIntro({ scheduleCount: 0 });
    expect(screen.getByRole("button", { name: /^schedule/i })).toHaveTextContent("Schedule is empty");
  });

  // The old solid accent fill made this look like the page's primary action,
  // but it only moves focus to the Schedule quadrant. Add stays the primary.
  it("is a secondary control: bordered accent ink, no solid fill", () => {
    renderIntro();
    const button = screen.getByRole("button", { name: /^schedule/i });

    expect(button.className).toContain("border-accent");
    expect(button.className).toContain("text-accent");
    expect(button.className).not.toContain("bg-accent ");
    expect(button.className).not.toContain("text-on-accent");
  });

  it("explains what it does and names the shortcut in its tooltip", () => {
    renderIntro();
    expect(screen.getByRole("button", { name: /^schedule/i })).toHaveAttribute(
      "title",
      "Move focus to the Schedule quadrant (keyboard shortcut: Option 2)"
    );
  });

  it("hides the Option 2 key hint on touch screens", () => {
    renderIntro();
    const hint = screen.getByText("⌥2");
    expect(hint.className).toContain("pointer-coarse:hidden");
  });

  it("waits for the count before enabling, and guards Firefox state restore", () => {
    renderIntro({ scheduleCount: null });
    const button = screen.getByRole("button", { name: /^schedule/i });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("autocomplete", "off");
  });

  it("still hands the ⌥2 focus request to its caller", async () => {
    const user = userEvent.setup();
    const { onFocusSchedule } = renderIntro();

    await user.click(screen.getByRole("button", { name: /^schedule/i }));
    expect(onFocusSchedule).toHaveBeenCalledTimes(1);
  });

  // The design frame is a 1500px desktop board, and taking its single row
  // literally overflowed a 390px phone by 64px — the date, the reading, and a
  // 193px button cannot share one line there. The row starts at sm; below it
  // the three parts stack, which is what the two-column section used to do.
  it("stacks the three parts on a phone instead of overflowing the viewport", () => {
    const { container } = renderIntro();
    const section = container.querySelector("section");

    expect(section?.className).toContain("flex-col");
    expect(section?.className).toContain("sm:flex-row");
    expect(section?.className).toContain("sm:items-center");
  });

  it("says 'Today's matrix' once to assistive tech", () => {
    renderIntro({ dateLabel: "Thursday, October 22", message: null });

    // The h1 carries the phrase as a visually hidden prefix, so the visible
    // eyebrow stays out of the tree instead of announcing it a second time.
    const eyebrows = screen.getAllByText(/Today.s matrix/).filter((el) => !el.closest("h1"));
    expect(eyebrows).toHaveLength(1);
    expect(eyebrows[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no date text before hydration so the static export stays date-free", () => {
    renderIntro({ dateLabel: null, message: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Today.s matrix —\s*$/);
  });
});
