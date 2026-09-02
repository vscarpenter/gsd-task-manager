import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import {
  FOCUS_CAPTURE_EVENT,
  FOCUS_QUADRANT_EVENT,
} from "@/lib/use-shell-command-handlers";

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

  it("lets matrix content own the page heading while retaining a compact shell label", () => {
    render(
      <AppShell title="GSD Matrix" titleAsLabel>
        <h1>Saturday, August 1</h1>
      </AppShell>
    );

    expect(screen.getByText("GSD Matrix").tagName).toBe("P");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Saturday, August 1");
  });

  it("accepts a matrix-only main width and mobile clearance contract", () => {
    render(
      <AppShell title="GSD Matrix" mainClassName="max-w-[1540px] pb-48 md:pb-6">
        <div>content</div>
      </AppShell>
    );

    expect(screen.getByRole("main")).toHaveClass("max-w-[1540px]", "pb-48", "md:pb-6");
  });

  it("provides a first-focusable skip link and targetable main region", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    await user.tab();
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveFocus();
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(skipLink.className).toContain("safe-area-inset-top");
    expect(skipLink.className).toContain("safe-area-inset-left");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("keeps the fixed mobile navigation after page content in keyboard order", () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    const main = screen.getByRole("main");
    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
    expect(main.compareDocumentPosition(mobileNav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives shell search, command, and footer links coarse-pointer targets", () => {
    render(
      <AppShell title="Test" searchQuery="" onSearchChange={vi.fn()}>
        <div>content</div>
      </AppShell>
    );

    expect(screen.getByRole("button", { name: /open command palette/i })).toHaveClass("touch-target");
    expect(screen.getByRole("textbox", { name: "Search tasks" })).toHaveClass("touch-target");
    expect(screen.getByRole("link", { name: /Vinny\s+Carpenter/ })).toHaveClass("touch-target");
  });

  it("keeps a quiet feedback link in the footer", () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    const link = screen.getByRole("link", { name: "Send feedback" });
    expect(link).toHaveAttribute("href", "/settings#feedback");
    expect(link).toHaveClass("touch-target");
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

  it("opens universal search from the physical Option+/ shortcut", async () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(window, { code: "Slash", key: "÷", altKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search tasks, actions, settings...")).toBeInTheDocument();
    });
  });

  it("suppresses global Option shortcuts while the command palette is open", async () => {
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(window, { code: "Slash", key: "÷", altKey: true });
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open")
    );

    fireEvent.keyDown(window, { code: "KeyR", key: "®", altKey: true });

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("routes Option capture, review, and quadrant focus through the shell", () => {
    const capture = vi.fn();
    const quadrant = vi.fn();
    window.addEventListener(FOCUS_CAPTURE_EVENT, capture);
    window.addEventListener(FOCUS_QUADRANT_EVENT, quadrant);
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    fireEvent.keyDown(window, { code: "KeyN", key: "Dead", altKey: true });
    fireEvent.keyDown(window, { code: "Digit2", key: "™", altKey: true });
    fireEvent.keyDown(window, { code: "KeyR", key: "®", altKey: true });

    expect(capture).toHaveBeenCalledOnce();
    expect((quadrant.mock.calls[0][0] as CustomEvent).detail).toEqual({ quadrant: "q2" });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    window.removeEventListener(FOCUS_CAPTURE_EVENT, capture);
    window.removeEventListener(FOCUS_QUADRANT_EVENT, quadrant);
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

  it("restores the command button after an in-place action in click-only browsers", async () => {
    const user = userEvent.setup();
    render(
      <AppShell title="Test">
        <div>content</div>
      </AppShell>
    );

    const commandButton = screen.getByRole("button", { name: /open command palette/i });
    fireEvent.click(commandButton);
    await user.click(await screen.findByText("Toggle theme"));

    await waitFor(() => expect(commandButton).toHaveFocus());
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
        icon: "flame",
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
    // Label is the name alone; the glyph renders in the item's icon slot.
    expect(screen.getByText("Today's Focus")).toBeInTheDocument();
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
