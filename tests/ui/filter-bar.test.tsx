import { describe, it, expect, vi } from "vitest";
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

  it("displays quadrant filter chips", () => {
    const criteria: FilterCriteria = {
      quadrants: ["urgent-important", "not-urgent-important"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/do first/i)).toBeInTheDocument();
    expect(screen.getByText(/schedule/i)).toBeInTheDocument();
  });

  it("displays status filter chip", () => {
    const criteria: FilterCriteria = {
      status: "active"
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/status: active/i)).toBeInTheDocument();
  });

  it("displays tags filter chips", () => {
    const criteria: FilterCriteria = {
      tags: ["work", "urgent"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/tag: work/i)).toBeInTheDocument();
    expect(screen.getByText(/tag: urgent/i)).toBeInTheDocument();
  });

  it("displays overdue filter chip", () => {
    const criteria: FilterCriteria = {
      overdue: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it("displays due today filter chip", () => {
    const criteria: FilterCriteria = {
      dueToday: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/due today/i)).toBeInTheDocument();
  });

  it("displays due this week filter chip", () => {
    const criteria: FilterCriteria = {
      dueThisWeek: true
    };

    render(<FilterBar criteria={criteria} onChange=  {mockOnChange} />);

    expect(screen.getByText(/due this week/i)).toBeInTheDocument();
  });

  it("displays no deadline filter chip", () => {
    const criteria: FilterCriteria = {
      noDueDate: true
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/no deadline/i)).toBeInTheDocument();
  });

  it("displays date range filter chip", () => {
    const criteria: FilterCriteria = {
      dueDateRange: {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-12-31T00:00:00.000Z"
      }
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/date range/i)).toBeInTheDocument();
  });

  it("displays recurrence filter chips", () => {
    const criteria: FilterCriteria = {
      recurrence: ["daily", "weekly"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    expect(screen.getByText(/recurs: daily/i)).toBeInTheDocument();
    expect(screen.getByText(/recurs: weekly/i)).toBeInTheDocument();
  });

  it("removes quadrant filter when chip is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      quadrants: ["urgent-important", "not-urgent-important"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    const chip = screen.getByText(/do first/i).closest("button");
    if (chip) {
      await user.click(chip);
    }

    expect(mockOnChange).toHaveBeenCalledWith({
      quadrants: ["not-urgent-important"]
    });
  });

  it("removes tag filter when chip is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      tags: ["work", "urgent"]
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    const chip = screen.getByText(/tag: work/i).closest("button");
    if (chip) {
      await user.click(chip);
    }

    expect(mockOnChange).toHaveBeenCalledWith({
      tags: ["urgent"]
    });
  });

  it("removes status filter when chip is clicked", async () => {
    const user = userEvent.setup();
    const criteria: FilterCriteria = {
      status: "completed"
    };

    render(<FilterBar criteria={criteria} onChange={mockOnChange} />);

    const chip = screen.getByText(/status: completed/i).closest("button");
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

    expect(screen.getByText(/do first/i)).toBeInTheDocument();
    expect(screen.getByText(/status: active/i)).toBeInTheDocument();
    expect(screen.getByText(/tag: work/i)).toBeInTheDocument();
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    expect(screen.getByText(/recurs: daily/i)).toBeInTheDocument();
  });
});
