import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "@/components/filter-bar";
import type { FilterCriteria } from "@/lib/filters";

describe("FilterBar", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no filters are active", () => {
    const { container } = render(<FilterBar criteria={{}} onChange={mockOnChange} />);

    expect(container.firstChild).toBeNull();
  });

  it("displays quadrant filter chip with count", () => {
    const criteria: FilterCriteria = {
      quadrants: ["urgent-important", "not-urgent-important"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("2 quadrants")).toBeInTheDocument();
  });

  it("displays status filter chip", () => {
    const criteria: FilterCriteria = {
      status: "active"
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("displays tags filter chip with count", () => {
    const criteria: FilterCriteria = {
      tags: ["work", "urgent"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("2 tags")).toBeInTheDocument();
  });

  it("displays overdue filter chip", () => {
    const criteria: FilterCriteria = {
      overdue: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("overdue")).toBeInTheDocument();
  });

  it("displays due today filter chip", () => {
    const criteria: FilterCriteria = {
      dueToday: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("due today")).toBeInTheDocument();
  });

  it("displays due this week filter chip", () => {
    const criteria: FilterCriteria = {
      dueThisWeek: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("this week")).toBeInTheDocument();
  });

  it("displays no deadline filter chip", () => {
    const criteria: FilterCriteria = {
      noDueDate: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("no deadline")).toBeInTheDocument();
  });

  it("displays date range filter chip", () => {
    const criteria: FilterCriteria = {
      dueDateRange: {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-12-31T00:00:00.000Z"
      }
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("custom date range")).toBeInTheDocument();
  });

  it("displays recurrence filter chips", () => {
    const criteria: FilterCriteria = {
      recurrence: ["daily", "weekly"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("daily, weekly")).toBeInTheDocument();
  });

  it("removes quadrant filter when chip is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      quadrants: ["urgent-important", "not-urgent-important"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    const chip = screen.getByText("2 quadrants").closest("button");
    if (chip) {
      await user.click(chip);
    }

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("removes tag filter when chip is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      tags: ["work", "urgent"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    const chip = screen.getByText("2 tags").closest("button");
    if (chip) {
      await user.click(chip);
    }

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("removes status filter when chip is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      status: "completed"
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    const chip = screen.getByText("completed").closest("button");
    if (chip) {
      await user.click(chip);
    }

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("clears all filters when Clear All button is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      quadrants: ["urgent-important"],
      status: "active",
      tags: ["work"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it("displays multiple filter types simultaneously", () => {
    const criteria: FilterCriteria = {
      quadrants: ["urgent-important"],
      status: "active",
      tags: ["work"],
      overdue: true,
      recurrence: ["daily"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText("1 quadrant")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("1 tag")).toBeInTheDocument();
    expect(screen.getByText("overdue")).toBeInTheDocument();
    expect(screen.getByText("daily")).toBeInTheDocument();
  });
});
