import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixIntro } from "@/components/matrix-simplified/matrix-intro";

/**
 * The briefing is one row, not a two-column section: on a 13" laptop the old
 * display-size date plus the Protect Q2 card cost ~190px before the first
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

  it("collapses the Protect Q2 card into one accent button carrying the count", () => {
    renderIntro({ scheduleCount: 4 });
    const button = screen.getByRole("button", { name: /protect q2/i });

    expect(button).toHaveTextContent("Protect Q2 · 4 to schedule");
    expect(button.className).toContain("bg-accent");
    expect(button.className).toContain("text-on-accent");
    expect(screen.getByText("⌥2")).toBeInTheDocument();
  });

  it("reads 'clear' rather than '0 to schedule' when Q2 is empty", () => {
    renderIntro({ scheduleCount: 0 });
    expect(screen.getByRole("button", { name: /protect q2/i })).toHaveTextContent(
      "Protect Q2 · clear"
    );
  });

  it("waits for the count before enabling, and guards Firefox state restore", () => {
    renderIntro({ scheduleCount: null });
    const button = screen.getByRole("button", { name: /protect q2/i });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("autocomplete", "off");
  });

  it("still hands the ⌥2 focus request to its caller", async () => {
    const user = userEvent.setup();
    const { onFocusSchedule } = renderIntro();

    await user.click(screen.getByRole("button", { name: /protect q2/i }));
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

  it("renders no date text before hydration so the static export stays date-free", () => {
    renderIntro({ dateLabel: null, message: null });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Today.s matrix —\s*$/);
  });
});
