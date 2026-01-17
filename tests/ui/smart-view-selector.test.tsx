import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { SmartViewSelector } from "@/components/smart-view-selector";
import type { SmartView } from "@/lib/filters";
import { renderWithAct } from "../utils/render-with-act";

// Mock the smart views module
const mockGetSmartViews = vi.fn();
const mockDeleteSmartView = vi.fn();
const mockGetAppPreferences = vi.fn();
const mockPinSmartView = vi.fn();
const mockUnpinSmartView = vi.fn();

const builtInViews: SmartView[] = [
  {
    id: "today",
    name: "Today's Focus",
    icon: "📅",
    criteria: { dueToday: true },
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  },
  {
    id: "this-week",
    name: "This Week",
    icon: "📆",
    criteria: { dueThisWeek: true },
    isBuiltIn: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  }
];

vi.mock("@/lib/smart-views", () => ({
  getSmartViews: () => mockGetSmartViews(),
  deleteSmartView: (id: string) => mockDeleteSmartView(id),
  getAppPreferences: () => mockGetAppPreferences(),
  pinSmartView: (id: string) => mockPinSmartView(id),
  unpinSmartView: (id: string) => mockUnpinSmartView(id),
}));

describe("SmartViewSelector", () => {
  const mockOnSelectView = vi.fn();
  const defaultProps = {
    onSelectView: mockOnSelectView,
    currentCriteria: {}
  };

  const customSmartView: SmartView = {
    id: "custom-1",
    name: "My Custom View",
    criteria: { tags: ["work"], status: "active" },
    isBuiltIn: false,
    createdAt: "2024-01-15T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z"
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // By default, return only built-in views
    mockGetSmartViews.mockResolvedValue(builtInViews);
    mockGetAppPreferences.mockResolvedValue({ pinnedSmartViewIds: [], maxPinnedViews: 5 });
  });

  it("renders the selector button", async () => {
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    expect(screen.getByRole("button", { name: /smart views/i })).toBeInTheDocument();
  });

  it("opens dropdown when button is clicked", async () => {
    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
    });
  });

  it("displays built-in smart views", async () => {
    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
      expect(screen.getByText("This Week")).toBeInTheDocument();
    });
  });

  it("displays custom smart views", async () => {
    mockGetSmartViews.mockResolvedValue([...builtInViews, customSmartView]);

    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("My Custom View")).toBeInTheDocument();
    });
  });

  it("calls onSelect when a smart view is clicked", async () => {
    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Today's Focus"));

    expect(mockOnSelectView).toHaveBeenCalledWith(
      expect.objectContaining({ dueToday: true })
    );
  });

  it("shows delete button for custom views", async () => {
    mockGetSmartViews.mockResolvedValue([...builtInViews, customSmartView]);

    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("My Custom View")).toBeInTheDocument();
    });

    // Look for delete button (trash icon)
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it("does not show delete button for built-in views", async () => {
    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
    });

    // Built-in views should not have delete buttons
    const todayFocusItem = screen.getByText("Today's Focus").closest("button");
    const deleteButton = todayFocusItem?.querySelector('[aria-label="Delete"]');
    expect(deleteButton).not.toBeInTheDocument();
  });

  it("calls deleteSmartView when delete button is clicked", async () => {
    mockGetSmartViews.mockResolvedValue([...builtInViews, customSmartView]);
    mockDeleteSmartView.mockResolvedValue(undefined);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("My Custom View")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteSmartView).toHaveBeenCalledWith("custom-1");
    });

    confirmSpy.mockRestore();
  });

  it("displays empty state when no custom views exist", async () => {
    mockGetSmartViews.mockResolvedValue(builtInViews);

    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      // Should only show built-in views, no custom views section or message
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
      expect(screen.queryByText("Custom Views")).not.toBeInTheDocument();
    });
  });

  it("closes dropdown after selecting a view", async () => {
    const user = userEvent.setup();
    await renderWithAct(<SmartViewSelector {...defaultProps} />);

    // Open dropdown
    await user.click(screen.getByRole("button", { name: /smart views/i }));

    await waitFor(() => {
      expect(screen.getByText("Today's Focus")).toBeInTheDocument();
    });

    // Select a view
    await user.click(screen.getByText("Today's Focus"));

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByText("This Week")).not.toBeInTheDocument();
    });
  });
});
