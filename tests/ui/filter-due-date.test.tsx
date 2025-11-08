import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterDueDate } from "@/components/filter-due-date";
import type { FilterCriteria } from "@/lib/filters";

describe("FilterDueDate", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Preset Options", () => {
    it("toggles overdue filter when Overdue button is clicked", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      await user.click(screen.getByRole("button", { name: /overdue/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        overdue: true,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined,
        dueDateRange: undefined
      });
    });

    it("deactivates overdue filter when clicked again", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = { overdue: true };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      await user.click(screen.getByRole("button", { name: /overdue/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        overdue: false,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined,
        dueDateRange: undefined
      });
    });

    it("toggles due today filter when Today button is clicked", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      await user.click(screen.getByRole("button", { name: /^today$/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        dueToday: true,
        overdue: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined,
        dueDateRange: undefined
      });
    });

    it("toggles due this week filter when This Week button is clicked", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      await user.click(screen.getByRole("button", { name: /this week/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        dueThisWeek: true,
        overdue: undefined,
        dueToday: undefined,
        noDueDate: undefined,
        dueDateRange: undefined
      });
    });

    it("toggles no deadline filter when No Deadline button is clicked", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      await user.click(screen.getByRole("button", { name: /no deadline/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        noDueDate: true,
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        dueDateRange: undefined
      });
    });

    it("applies active styling to overdue button when filter is active", () => {
      const criteria: FilterCriteria = { overdue: true };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const button = screen.getByRole("button", { name: /overdue/i });
      expect(button).toHaveClass("border-red-500", "bg-red-50", "font-medium", "text-red-700");
    });

    it("applies active styling to today button when filter is active", () => {
      const criteria: FilterCriteria = { dueToday: true };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const button = screen.getByRole("button", { name: /^today$/i });
      expect(button).toHaveClass("border-amber-500", "bg-amber-50", "font-medium", "text-amber-700");
    });

    it("applies active styling to this week button when filter is active", () => {
      const criteria: FilterCriteria = { dueThisWeek: true };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const button = screen.getByRole("button", { name: /this week/i });
      expect(button).toHaveClass("border-accent", "bg-accent/10", "font-medium");
    });

    it("applies active styling to no deadline button when filter is active", () => {
      const criteria: FilterCriteria = { noDueDate: true };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const button = screen.getByRole("button", { name: /no deadline/i });
      expect(button).toHaveClass("border-accent", "bg-accent/10", "font-medium");
    });
  });

  describe("Custom Date Range", () => {
    it("sets start date when From input is changed", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/from/i);
      await user.type(startInput, "2024-01-15");

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: {
          start: expect.stringContaining("2024-01-15"),
          end: undefined
        },
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });

    it("sets end date when To input is changed", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const endInput = screen.getByLabelText(/to/i);
      await user.type(endInput, "2024-12-31");

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: {
          start: undefined,
          end: expect.stringContaining("2024-12-31")
        },
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });

    it("sets start date with existing end date", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {
        dueDateRange: {
          end: "2024-12-31T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/from/i);
      await user.type(startInput, "2024-06-01");

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: {
          start: expect.stringContaining("2024-06-01"),
          end: "2024-12-31T00:00:00.000Z"
        },
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });

    it("sets end date with existing start date", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {
        dueDateRange: {
          start: "2024-01-01T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const endInput = screen.getByLabelText(/to/i);
      await user.type(endInput, "2024-06-30");

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: {
          start: "2024-01-01T00:00:00.000Z",
          end: expect.stringContaining("2024-06-30")
        },
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });

    it("displays existing start date in From input", () => {
      const criteria: FilterCriteria = {
        dueDateRange: {
          start: "2024-01-15T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/from/i) as HTMLInputElement;
      expect(startInput.value).toBe("2024-01-15");
    });

    it("displays existing end date in To input", () => {
      const criteria: FilterCriteria = {
        dueDateRange: {
          end: "2024-12-31T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const endInput = screen.getByLabelText(/to/i) as HTMLInputElement;
      expect(endInput.value).toBe("2024-12-31");
    });

    it("clears date range when start date is cleared", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {
        dueDateRange: {
          start: "2024-01-01T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/from/i);
      await user.clear(startInput);

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: undefined,
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });

    it("clears date range when end date is cleared and no start date exists", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {
        dueDateRange: {
          end: "2024-12-31T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const endInput = screen.getByLabelText(/to/i);
      await user.clear(endInput);

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: undefined,
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });
  });

  describe("Filter Interactions", () => {
    it("clears preset filters when custom date range is set", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {
        overdue: true,
        dueToday: true
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/from/i);
      await user.type(startInput, "2024-01-01");

      expect(mockOnChange).toHaveBeenCalledWith({
        dueDateRange: {
          start: expect.stringContaining("2024-01-01"),
          end: undefined
        },
        overdue: undefined,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined
      });
    });

    it("clears custom date range when preset filter is selected", async () => {
      const user = userEvent.setup();
      const criteria: FilterCriteria = {
        dueDateRange: {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-12-31T00:00:00.000Z"
        }
      };

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      await user.click(screen.getByRole("button", { name: /overdue/i }));

      expect(mockOnChange).toHaveBeenCalledWith({
        overdue: true,
        dueToday: undefined,
        dueThisWeek: undefined,
        noDueDate: undefined,
        dueDateRange: undefined
      });
    });
  });

  describe("Component Rendering", () => {
    it("renders all preset filter buttons", () => {
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      expect(screen.getByRole("button", { name: /overdue/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^today$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /this week/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /no deadline/i })).toBeInTheDocument();
    });

    it("renders custom date range section", () => {
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      expect(screen.getByText(/custom date range/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
    });

    it("renders date inputs with correct type", () => {
      const criteria: FilterCriteria = {};

      render(<FilterDueDate criteria={criteria} onChange={mockOnChange} />);

      const startInput = screen.getByLabelText(/from/i);
      const endInput = screen.getByLabelText(/to/i);

      expect(startInput).toHaveAttribute("type", "date");
      expect(endInput).toHaveAttribute("type", "date");
    });
  });
});
