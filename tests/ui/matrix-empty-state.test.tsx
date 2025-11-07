import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixEmptyState } from "@/components/matrix-empty-state";

describe("MatrixEmptyState", () => {
  it("renders welcome header", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    expect(screen.getByText("Welcome to GSD Task Manager")).toBeInTheDocument();
    expect(screen.getByText(/Get Stuff Done/)).toBeInTheDocument();
  });

  it("renders all four quadrants", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    expect(screen.getByText("Do First")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Delegate")).toBeInTheDocument();
    expect(screen.getByText("Eliminate")).toBeInTheDocument();
  });

  it("renders quadrant descriptions", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    expect(screen.getByText(/Urgent \+ Important/)).toBeInTheDocument();
    expect(screen.getByText(/Not Urgent \+ Important/)).toBeInTheDocument();
    expect(screen.getByText(/Urgent \+ Not Important/)).toBeInTheDocument();
    expect(screen.getByText(/Not Urgent \+ Not Important/)).toBeInTheDocument();
  });

  it("renders quick tips", () => {
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    expect(screen.getByText(/to create a new task/)).toBeInTheDocument();
    expect(screen.getByText(/All your data stays private/)).toBeInTheDocument();
    expect(screen.getByText(/Export your tasks regularly/)).toBeInTheDocument();
  });

  it("calls onCreateTask when button clicked", async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    render(<MatrixEmptyState onCreateTask={onCreateTask} />);

    await user.click(screen.getByText("Create your first task"));

    expect(onCreateTask).toHaveBeenCalledOnce();
  });
});
