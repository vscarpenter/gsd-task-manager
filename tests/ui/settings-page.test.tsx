import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsPage } from "@/components/settings-page";

// --- Mock factories (mock* prefix allows use before vi.mock hoisting) ---

const pushMock = vi.fn();
const mockGetNotificationSettings = vi.fn();
const mockGetSyncStatus = vi.fn();
const mockGetAppPreferences = vi.fn();
const mockReadShowCompleted = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({ all: [], isLoading: false }),
}));

vi.mock("@/lib/notifications", () => ({
  getNotificationSettings: (...args: unknown[]) =>
    mockGetNotificationSettings(...args),
  updateNotificationSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/config", () => ({
  getSyncStatus: (...args: unknown[]) => mockGetSyncStatus(...args),
}));

vi.mock("@/lib/tasks", () => ({
  exportToJsonWithReport: vi.fn().mockResolvedValue({ json: "{}", skippedCount: 0 }),
}));

vi.mock("@/lib/smart-views", () => ({
  APP_PREFERENCES_EVENT: "gsd:app-preferences",
  getAppPreferences: (...args: unknown[]) => mockGetAppPreferences(...args),
  updateAppPreferences: vi.fn().mockResolvedValue({ smartViewsEnabled: true }),
}));

vi.mock("@/lib/preferences/show-completed", () => ({
  SHOW_COMPLETED_EVENT: "gsd:show-completed",
  SHOW_COMPLETED_KEY: "gsd:show-completed",
  readShowCompleted: (...args: unknown[]) => mockReadShowCompleted(...args),
}));

// Stub the leaf settings sections so the test focuses on the shell's
// navigation + section-rendering behavior, not the sections' internals.
vi.mock("@/components/settings/appearance-settings", () => ({
  AppearanceSettings: () => <div data-testid="section-appearance">Appearance section</div>,
}));
vi.mock("@/components/settings/feature-settings", () => ({
  FeatureSettings: () => <div data-testid="section-features">Features section</div>,
}));
vi.mock("@/components/settings/notification-settings", () => ({
  NotificationSettingsSection: () => (
    <div data-testid="section-notifications">Notifications section</div>
  ),
}));
vi.mock("@/components/settings/sync-settings", () => ({
  SyncSettings: () => <div data-testid="section-sync">Sync section</div>,
}));
vi.mock("@/components/settings/archive-settings", () => ({
  ArchiveSettings: () => <div data-testid="section-archive">Archive section</div>,
}));
vi.mock("@/components/settings/data-management", () => ({
  DataManagement: () => <div data-testid="section-data">Data section</div>,
}));
vi.mock("@/components/settings/about-section", () => ({
  AboutSection: () => <div data-testid="section-about">About section</div>,
}));

// --- Setup ---

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "";
  mockGetNotificationSettings.mockResolvedValue({
    id: "settings",
    enabled: true,
    defaultReminder: 30,
    soundEnabled: true,
    permissionAsked: true,
    updatedAt: new Date().toISOString(),
  });
  mockGetSyncStatus.mockResolvedValue({ enabled: true, pendingCount: 0 });
  mockGetAppPreferences.mockResolvedValue({
    id: "preferences",
    smartViewsEnabled: false,
  });
  mockReadShowCompleted.mockReturnValue(false);
});

async function renderPage() {
  render(<SettingsPage />);
  // Wait for the async data load to resolve (spinner -> content).
  await screen.findAllByText("Appearance");
}

// --- Tests ---

describe("SettingsPage", () => {
  it("renders all section nav headings once data has loaded", async () => {
    await renderPage();

    // Sidebar exposes every section as a nav button label. Sync is included
    // because getSyncStatus reports enabled.
    for (const label of [
      "Appearance",
      "Features",
      "Notifications",
      "Cloud Sync",
      "Archive",
      "Data & Storage",
      "About",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("leaves page-level main and h1 semantics to the application shell", async () => {
    const { container } = render(<SettingsPage />);
    await screen.findAllByText("Appearance");

    expect(container.querySelector("main")).toBeNull();
    expect(container.querySelector("h1")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
  });

  it("defaults to the appearance section", async () => {
    await renderPage();
    expect(screen.getByTestId("section-appearance")).toBeInTheDocument();
    expect(screen.queryByTestId("section-about")).not.toBeInTheDocument();
  });

  it("updates the active section when a nav item is selected", async () => {
    await renderPage();

    // Click the "About" nav item (mobile + desktop render it; click the first).
    fireEvent.click(screen.getAllByText("About")[0]);

    expect(await screen.findByTestId("section-about")).toBeInTheDocument();
    expect(screen.queryByTestId("section-appearance")).not.toBeInTheDocument();
  });

  it("switches between multiple sections", async () => {
    await renderPage();

    fireEvent.click(screen.getAllByText("Notifications")[0]);
    expect(await screen.findByTestId("section-notifications")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Data & Storage")[0]);
    expect(await screen.findByTestId("section-data")).toBeInTheDocument();
    expect(screen.queryByTestId("section-notifications")).not.toBeInTheDocument();
  });

  it("hides the Cloud Sync section when sync is disabled", async () => {
    mockGetSyncStatus.mockResolvedValue({ enabled: false, pendingCount: 0 });
    await renderPage();
    expect(screen.queryByText("Cloud Sync")).not.toBeInTheDocument();
  });

  it("honors the initial location hash for the active section", async () => {
    window.location.hash = "#notifications";
    render(<SettingsPage />);
    expect(await screen.findByTestId("section-notifications")).toBeInTheDocument();
  });
});
