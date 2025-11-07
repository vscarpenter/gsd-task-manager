import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionsBar } from "@/components/bulk-actions-bar";

describe("BulkActionsBar", () => {
  const mockHandlers = {
    onClearSelection: vi.fn(),
    onBulkDelete: vi.fn(),
    onBulkComplete: vi.fn(),
    onBulkUncomplete: vi.fn(),
    onBulkMoveToQuadrant: vi.fn(),
    onBulkAddTags: vi.fn(),
  };

  it("does not render when no tasks selected", () => {
    const { container } = render(
      <BulkActionsBar selectedCount={0} {...mockHandlers} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders when tasks are selected", () => {
    render(<BulkActionsBar selectedCount={3} {...mockHandlers} />);

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("calls onClearSelection when clear button clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar selectedCount={2} {...mockHandlers} />);

    await user.click(screen.getByLabelText("Clear selection"));

    expect(mockHandlers.onClearSelection).toHaveBeenCalledOnce();
  });

  it("calls onBulkComplete when complete button clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar selectedCount={2} {...mockHandlers} />);

    await user.click(screen.getByTitle("Mark selected as complete"));

    expect(mockHandlers.onBulkComplete).toHaveBeenCalledOnce();
  });

  it("calls onBulkUncomplete when uncomplete button clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar selectedCount={2} {...mockHandlers} />);

    await user.click(screen.getByTitle("Mark selected as incomplete"));

    expect(mockHandlers.onBulkUncomplete).toHaveBeenCalledOnce();
  });

  it("calls onBulkAddTags when tag button clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar selectedCount={2} {...mockHandlers} />);

    await user.click(screen.getByTitle("Add tags to selected"));

    expect(mockHandlers.onBulkAddTags).toHaveBeenCalledOnce();
  });

  it("calls onBulkDelete when delete button clicked", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar selectedCount={2} {...mockHandlers} />);

    await user.click(screen.getByTitle("Delete selected tasks"));

    expect(mockHandlers.onBulkDelete).toHaveBeenCalledOnce();
  });

  it("opens move dropdown and allows quadrant selection", async () => {
    const user = userEvent.setup();
    render(<BulkActionsBar selectedCount={2} {...mockHandlers} />);

    await user.click(screen.getByTitle("Move to quadrant"));

    expect(screen.getByText("Do First")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Delegate")).toBeInTheDocument();
    expect(screen.getByText("Eliminate")).toBeInTheDocument();

    await user.click(screen.getByText("Do First"));

    expect(mockHandlers.onBulkMoveToQuadrant).toHaveBeenCalledWith(
      "urgent-important"
    );
  });

  it("closes move dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <BulkActionsBar selectedCount={2} {...mockHandlers} />
        <div data-testid="outside">Outside</div>
      </div>
    );

    await user.click(screen.getByTitle("Move to quadrant"));
    expect(screen.getByText("Do First")).toBeInTheDocument();

    await user.click(screen.getByTestId("outside"));

    expect(screen.queryByText("Do First")).not.toBeInTheDocument();
  });
});
