import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppHeader } from "@/components/app-header";

// Mock SmartViewSelector component
vi.mock("@/components/smart-view-selector", () => ({
  SmartViewSelector: () => <div data-testid="smart-view-selector">Smart View Selector</div>
}));

// Mock SettingsMenu component
vi.mock("@/components/settings-menu", () => ({
  SettingsMenu: ({ onExport, onImport }: { onExport: () => void; onImport: (file: File) => void }) => (
    <div data-testid="settings-menu">
      <button onClick={onExport}>Export</button>
      <input type="file" onChange={(e) => e.target.files && onImport(e.target.files[0])} />
    </div>
  )
}));

// Mock ThemeToggle component
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme Toggle</button>
}));

describe("AppHeader", () => {
  const mockHandlers = {
    onNewTask: vi.fn(),
    onSearchChange: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onHelp: vi.fn(),
    onSelectSmartView: vi.fn(),
    onOpenFilters: vi.fn(),
    onToggleCompleted: vi.fn(),
    onOpenNotifications: vi.fn()
  };

  const searchInputRef = { current: null };

  const defaultProps = {
    ...mockHandlers,
    searchQuery: "",
    searchInputRef,
    isLoading: false,
    currentFilterCriteria: {},
    showCompleted: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the logo and title", () => {
    render(<AppHeader {...defaultProps} />);

    expect(screen.getByText("GSD")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<AppHeader {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search tasks/i);
    expect(searchInput).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(<AppHeader {...defaultProps} onSearchChange={onSearchChange} />);

    const searchInput = screen.getByPlaceholderText(/search tasks/i);
    await user.type(searchInput, "test query");

    expect(onSearchChange).toHaveBeenCalledWith("test query");
  });

  it("renders new task button", () => {
    render(<AppHeader {...defaultProps} />);

    expect(screen.getByRole("button", { name: /new task/i })).toBeInTheDocument();
  });

  it("calls onNewTask when new task button is clicked", async () => {
    const user = userEvent.setup();
    const onNewTask = vi.fn();

    render(<AppHeader {...defaultProps} onNewTask={onNewTask} />);

    await user.click(screen.getByRole("button", { name: /new task/i }));

    expect(onNewTask).toHaveBeenCalled();
  });

  it("renders smart view selector", () => {
    render(<AppHeader {...defaultProps} />);

    expect(screen.getByTestId("smart-view-selector")).toBeInTheDocument();
  });

  it("renders settings menu", () => {
    render(<AppHeader {...defaultProps} />);

    expect(screen.getByTestId("settings-menu")).toBeInTheDocument();
  });

  it("renders theme toggle", () => {
    render(<AppHeader {...defaultProps} />);

    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders help button", () => {
    render(<AppHeader {...defaultProps} />);

    expect(screen.getByRole("button", { name: /help/i })).toBeInTheDocument();
  });

  it("calls onHelp when help button is clicked", async () => {
    const user = userEvent.setup();
    const onHelp = vi.fn();

    render(<AppHeader {...defaultProps} onHelp={onHelp} />);

    await user.click(screen.getByRole("button", { name: /help/i }));

    expect(onHelp).toHaveBeenCalled();
  });

  it("displays loading spinner when isLoading is true", () => {
    const { container } = render(<AppHeader {...defaultProps} isLoading={true} />);

    // Look for spinner element
    const spinner = container.querySelector('[class*="spinner"]');
    expect(spinner).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(<AppHeader {...defaultProps} searchQuery="test" onSearchChange={onSearchChange} />);

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearButton);

    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("does not show clear button when search is empty", () => {
    render(<AppHeader {...defaultProps} searchQuery="" />);

    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
  });

  it("shows clear button when search has text", () => {
    render(<AppHeader {...defaultProps} searchQuery="test" />);

    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();
  });
});
