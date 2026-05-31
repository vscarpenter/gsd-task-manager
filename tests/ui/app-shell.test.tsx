import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/matrix-simplified/app-shell";

const pushMock = vi.fn();
const mockGetAppPreferences = vi.fn();
const mockGetSmartViews = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

vi.mock("@/lib/use-view-transition", () => ({
  useViewTransition: () => ({
    navigateWithTransition: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/use-sync-status", () => ({
  useSyncStatus: () => ({ status: "idle", lastSyncedAt: null }),
}));

vi.mock("@/components/matrix-simplified/sync-status-display", () => ({
  SyncStatusDisplay: () => null,
}));

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({ all: [] }),
}));

vi.mock("@/lib/smart-views", () => ({
  APP_PREFERENCES_EVENT: "gsd:app-preferences",
  getAppPreferences: (...args: unknown[]) => mockGetAppPreferences(...args),
  getSmartViews: (...args: unknown[]) => mockGetSmartViews(...args),
}));

const setThemeMock = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: setThemeMock }),
}));

if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

describe("AppShell command palette wiring", () => {
  beforeEach(() => {
    mockGetAppPreferences.mockResolvedValue({
      id: "preferences",
      pinnedSmartViewIds: [],
      maxPinnedViews: 5,
      smartViewsEnabled: false,
    });
    mockGetSmartViews.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the command palette when Cmd+K is pressed", async () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search tasks, actions, settings...")
      ).toBeInTheDocument();
    });
  });

  it("opens the command palette when Ctrl+K is pressed", async () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search tasks, actions, settings...")
      ).toBeInTheDocument();
    });
  });

  it("opens the command palette from the visible topbar button", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    await user.click(screen.getByRole("button", { name: /open command palette/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search tasks, actions, settings...")
      ).toBeInTheDocument();
    });
  });

  it("does not surface smart-view actions in the palette", async () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Search tasks, actions, settings...")
      ).toBeInTheDocument()
    );

    expect(screen.queryByText("Smart Views")).not.toBeInTheDocument();
  });

  it("surfaces smart-view actions when the feature preference is enabled", async () => {
    mockGetAppPreferences.mockResolvedValue({
      id: "preferences",
      pinnedSmartViewIds: [],
      maxPinnedViews: 5,
      smartViewsEnabled: true,
    });
    mockGetSmartViews.mockResolvedValue([
      {
        id: "built-in-focus",
        name: "Today's Focus",
        icon: "🎯",
        criteria: { status: "active" },
        isBuiltIn: true,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => expect(screen.getByText("Smart Views")).toBeInTheDocument());
    expect(screen.getByText("🎯 Today's Focus")).toBeInTheDocument();
  });

  it("navigates to /settings when Open settings is executed", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.getByText("Open settings")).toBeInTheDocument());

    await user.click(screen.getByText("Open settings"));

    expect(pushMock).toHaveBeenCalledWith("/settings");
  });

  it("toggles theme when Toggle theme is executed", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.getByText("Toggle theme")).toBeInTheDocument());

    await user.click(screen.getByText("Toggle theme"));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});
