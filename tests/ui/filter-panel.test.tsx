import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterPanel } from "@/components/filter-panel";
import type { FilterCriteria } from "@/lib/filters";

describe("FilterPanel", () => {
  const mockOnChange = vi.fn();
  const mockOnSaveAsSmartView = vi.fn();
  const availableTags = ["work", "personal", "urgent"];

  const defaultCriteria: FilterCriteria = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders filter button", () => {
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("expands and collapses filter options", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={availableTags}
      />
    );

    expect(screen.queryByText("Quadrants")).not.toBeInTheDocument();

    await user.click(screen.getByText("Filters"));

    expect(screen.getByText("Quadrants")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("shows active filter count", () => {
    const criteria: FilterCriteria = {
      tags: ["work"],
      status: "active",
    };

    render(
      <FilterPanel
        criteria={criteria}
        onChange={mockOnChange}
        availableTags={availableTags}
      />
    );

    expect(screen.getByText(/active, 1 tag/)).toBeInTheDocument();
  });

  it("toggles quadrant filters", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText("Do First"));

    expect(mockOnChange).toHaveBeenCalledWith({
      quadrants: ["urgent-important"],
    });
  });

  it("toggles status filters", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText("active"));

    expect(mockOnChange).toHaveBeenCalledWith({ status: "active" });
  });

  it("toggles tag filters", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={availableTags}
      />
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText("#work"));

    expect(mockOnChange).toHaveBeenCalledWith({ tags: ["work"] });
  });

  it("toggles due date filters", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText("Overdue"));

    expect(mockOnChange).toHaveBeenCalledWith({
      overdue: true,
      dueToday: undefined,
      dueThisWeek: undefined,
    });
  });

  it("toggles recurrence filters", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText("daily"));

    expect(mockOnChange).toHaveBeenCalledWith({ recurrence: ["daily"] });
  });

  it("clears all filters", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      tags: ["work"],
      status: "active",
    };

    render(
      <FilterPanel
        criteria={criteria}
        onChange={mockOnChange}
        availableTags={availableTags}
      />
    );

    await user.click(screen.getByText("Clear"));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("shows save view button when filters are active", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = { tags: ["work"] };

    render(
      <FilterPanel
        criteria={criteria}
        onChange={mockOnChange}
        onSaveAsSmartView={mockOnSaveAsSmartView}
        availableTags={availableTags}
      />
    );

    await user.click(screen.getByText("Filters"));

    expect(screen.getByText("Save View")).toBeInTheDocument();
  });

  it("calls onSaveAsSmartView when save button clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = { tags: ["work"] };

    render(
      <FilterPanel
        criteria={criteria}
        onChange={mockOnChange}
        onSaveAsSmartView={mockOnSaveAsSmartView}
        availableTags={availableTags}
      />
    );

    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByText("Save View"));

    expect(mockOnSaveAsSmartView).toHaveBeenCalledOnce();
  });

  it("handles date range filters", async () => {
    const user = userEvent.setup();
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    await user.click(screen.getByText("Filters"));

    const startInput = screen.getByLabelText("From");
    await user.type(startInput, "2024-01-01");

    expect(mockOnChange).toHaveBeenCalledWith({
      dueDateRange: {
        start: expect.stringContaining("2024-01-01"),
        end: undefined,
      },
      overdue: undefined,
      dueToday: undefined,
      dueThisWeek: undefined,
    });
  });

  it("does not show tags section when no tags available", () => {
    render(
      <FilterPanel
        criteria={defaultCriteria}
        onChange={mockOnChange}
        availableTags={[]}
      />
    );

    expect(screen.queryByText("#work")).not.toBeInTheDocument();
  });
});
