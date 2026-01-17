import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveSmartViewDialog } from "@/components/save-smart-view-dialog";
import type { FilterCriteria } from "@/lib/filters";

// Mock the smart-views module
const mockCreateSmartView = vi.fn();

vi.mock("@/lib/smart-views", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createSmartView: (view: any) => mockCreateSmartView(view)
}));

describe("SaveSmartViewDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSaved = vi.fn();
  const mockCriteria: FilterCriteria = {
    tags: ["work"],
    status: "active"
  };

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    criteria: mockCriteria,
    onSaved: mockOnSaved
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSmartView.mockResolvedValue({
      id: "test-id",
      name: "Test View",
      criteria: mockCriteria,
      isBuiltIn: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    });
  });

  it("renders dialog when open", () => {
    render(<SaveSmartViewDialog {...defaultProps} />);

    expect(screen.getByText("Save as Smart View")).toBeInTheDocument();
    expect(screen.getByText(/create a custom smart view/i)).toBeInTheDocument();
  });

  it("does not render dialog when closed", () => {
    render(<SaveSmartViewDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Save as Smart View")).not.toBeInTheDocument();
  });

  it("renders all form fields", () => {
    render(<SaveSmartViewDialog {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/icon/i)).toBeInTheDocument();
  });

  it("submits form with valid name", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "My Custom View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockCreateSmartView).toHaveBeenCalledWith({
        name: "My Custom View",
        criteria: mockCriteria
      });
    });
  });

  it("submits form with name, description, and icon", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Work Tasks");
    await user.type(screen.getByLabelText(/description/i), "All work-related tasks");
    await user.type(screen.getByLabelText(/icon/i), "🎯");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockCreateSmartView).toHaveBeenCalledWith({
        name: "Work Tasks",
        description: "All work-related tasks",
        icon: "🎯",
        criteria: mockCriteria
      });
    });
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a name/i)).toBeInTheDocument();
    });

    expect(mockCreateSmartView).not.toHaveBeenCalled();
  });

  it("shows validation error when name is only whitespace", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "   ");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a name/i)).toBeInTheDocument();
    });

    expect(mockCreateSmartView).not.toHaveBeenCalled();
  });

  it("trims whitespace from name", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "  My View  ");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockCreateSmartView).toHaveBeenCalledWith({
        name: "My View",
        criteria: mockCriteria
      });
    });
  });

  it("trims whitespace from description and icon", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test");
    await user.type(screen.getByLabelText(/description/i), "  Test description  ");
    await user.type(screen.getByLabelText(/icon/i), "🎯");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockCreateSmartView).toHaveBeenCalledWith({
        name: "Test",
        description: "Test description",
        icon: "🎯",
        criteria: mockCriteria
      });
    });
  });

  it("omits description and icon when empty", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Simple View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockCreateSmartView).toHaveBeenCalledWith({
        name: "Simple View",
        criteria: mockCriteria
      });
    });
  });

  it("closes dialog after successful save", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("calls onSaved callback after successful save", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockOnSaved).toHaveBeenCalled();
    });
  });

  it("resets form after successful save", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const iconInput = screen.getByLabelText(/icon/i);

    await user.type(nameInput, "Test View");
    await user.type(descriptionInput, "Test description");
    await user.type(iconInput, "🎯");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    // Re-open dialog to check if form is reset
    render(<SaveSmartViewDialog {...defaultProps} open={true} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue("");
    expect(screen.getByLabelText(/description/i)).toHaveValue("");
    expect(screen.getByLabelText(/icon/i)).toHaveValue("");
  });

  it("shows error message when save fails", async () => {
    const user = userEvent.setup();
    mockCreateSmartView.mockRejectedValue(new Error("Database error"));

    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save smart view/i)).toBeInTheDocument();
    });
  });

  it("does not close dialog when save fails", async () => {
    const user = userEvent.setup();
    mockCreateSmartView.mockRejectedValue(new Error("Database error"));

    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save smart view/i)).toBeInTheDocument();
    });

    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("disables buttons while saving", async () => {
    const user = userEvent.setup();
    let resolveSave: () => void;
    mockCreateSmartView.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));

    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test View");
    const saveButton = screen.getByRole("button", { name: /save view/i });
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    await user.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    resolveSave!();

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows 'Saving...' text while saving", async () => {
    const user = userEvent.setup();
    let resolveSave: () => void;
    mockCreateSmartView.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));

    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/name/i), "Test View");
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
    });

    resolveSave!();
  });

  it("calls onOpenChange when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("respects maxLength for name field", () => {
    render(<SaveSmartViewDialog {...defaultProps} />);

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(nameInput.maxLength).toBe(50);
  });

  it("respects maxLength for description field", () => {
    render(<SaveSmartViewDialog {...defaultProps} />);

    const descriptionInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    expect(descriptionInput.maxLength).toBe(150);
  });

  it("respects maxLength for icon field", () => {
    render(<SaveSmartViewDialog {...defaultProps} />);

    const iconInput = screen.getByLabelText(/icon/i) as HTMLInputElement;
    expect(iconInput.maxLength).toBe(2);
  });

  it("clears error when user starts typing after validation error", async () => {
    const user = userEvent.setup();
    render(<SaveSmartViewDialog {...defaultProps} />);

    // Trigger validation error
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a name/i)).toBeInTheDocument();
    });

    // Start typing
    await user.type(screen.getByLabelText(/name/i), "New View");

    // Try to save again - error should be cleared during save attempt
    await user.click(screen.getByRole("button", { name: /save view/i }));

    await waitFor(() => {
      expect(mockCreateSmartView).toHaveBeenCalled();
    });
  });
});
