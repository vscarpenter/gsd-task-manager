import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixEmptyState } from "@/components/matrix-empty-state";

describe("MatrixEmptyState", () => {
  it("renders hero headline and CTA", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    expect(screen.getByText("Get Stuff Done")).toBeInTheDocument();
    expect(screen.getByText(/focus on what truly matters/)).toBeInTheDocument();
    expect(screen.getByText("Create your first task")).toBeInTheDocument();
  });

  it("hides quadrant details by default (progressive disclosure)", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    // Quadrant details should NOT be visible until user clicks "Learn more"
    expect(screen.queryByText("Do First")).not.toBeInTheDocument();
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();
  });

  it("reveals quadrant details when learn section is expanded", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    await user.click(screen.getByText("How the Eisenhower Matrix works"));

    expect(screen.getByText("Do First")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Delegate")).toBeInTheDocument();
    expect(screen.getByText("Eliminate")).toBeInTheDocument();
  });

  it("renders quadrant descriptions when expanded", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    await user.click(screen.getByText("How the Eisenhower Matrix works"));

    // Descriptions are inside <p> elements with <br/> separating desc from detail,
    // so we match partial text within the paragraph
    expect(screen.getByText(/Crises and deadlines/)).toBeInTheDocument();
    expect(screen.getByText(/Long-term goals/)).toBeInTheDocument();
    expect(screen.getByText(/can be delegated/)).toBeInTheDocument();
    expect(screen.getByText(/Time-wasters to minimize/)).toBeInTheDocument();
  });

  it("renders quick tips with keyboard shortcuts", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    expect(screen.getByText(/Keyboard shortcuts/)).toBeInTheDocument();
    expect(screen.getByText(/Command palette/)).toBeInTheDocument();
    expect(screen.getByText(/All data stays private/)).toBeInTheDocument();
  });

  it("calls onCreateTask when CTA button clicked", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    await user.click(screen.getByText("Create your first task"));

    expect(onCreateTask).toHaveBeenCalledOnce();
  });

  it("toggles learn section aria-expanded attribute", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    const toggleButton = screen.getByText("How the Eisenhower Matrix works").closest("button")!;
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
  });
});
