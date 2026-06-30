import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { TaskRecord } from "@/lib/types";
import type { SettingsData } from "@/components/settings-page/use-settings-data";

const pushMock = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
const mockExport = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
    warning: (...a: unknown[]) => mockToastWarning(...a),
  },
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/tasks", () => ({
  exportToJsonWithReport: (...a: unknown[]) => mockExport(...a),
}));

// Stub every leaf section EXCEPT DataManagement, which provides the real
// export/import controls this suite drives.
vi.mock("@/components/settings/appearance-settings", () => ({
  AppearanceSettings: () => <div data-testid="s-appearance" />,
}));
vi.mock("@/components/settings/feature-settings", () => ({
  FeatureSettings: () => <div data-testid="s-features" />,
}));
vi.mock("@/components/settings/notification-settings", () => ({
  NotificationSettingsSection: () => <div data-testid="s-notifications" />,
}));
vi.mock("@/components/settings/sync-settings", () => ({
  SyncSettings: (props: { onExport: () => Promise<boolean> }) => (
    <button type="button" data-testid="sync-export" onClick={() => props.onExport()}>
      sync-export
    </button>
  ),
}));
vi.mock("@/components/settings/archive-settings", () => ({
  ArchiveSettings: () => <div data-testid="s-archive" />,
}));
vi.mock("@/components/settings/about-section", () => ({
  AboutSection: () => <div data-testid="s-about" />,
}));
vi.mock("@/components/import-dialog", () => ({
  ImportDialog: (props: { onImportComplete: () => void }) => (
    <button type="button" data-testid="import-complete" onClick={props.onImportComplete}>
      import-complete
    </button>
  ),
}));

import { SettingsBody } from "@/components/settings-page/settings-body";

function makeTask(overrides: Partial<TaskRecord>): TaskRecord {
  return { id: "t", completed: false, ...overrides } as unknown as TaskRecord;
}

function makeSettings(overrides: Partial<SettingsData> = {}): SettingsData {
  return {
    dataLoaded: true,
    showCompleted: false,
    appPreferences: { id: "preferences", smartViewsEnabled: false } as never,
    notificationSettings: null,
    syncEnabled: true,
    pendingSync: 0,
    toggleCompleted: vi.fn(),
    toggleSmartViews: vi.fn(),
    notificationToggle: vi.fn(),
    defaultReminderChange: vi.fn(),
    markAccountDeleted: vi.fn(),
    ...overrides,
  };
}

const TASKS = [
  makeTask({ id: "a", completed: false }),
  makeTask({ id: "b", completed: true }),
  makeTask({ id: "c", completed: false }),
];

let createElementSpy: ReturnType<typeof vi.spyOn> | null = null;
let lastInput: HTMLInputElement | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mockExport.mockResolvedValue({ json: "{}", skippedCount: 0 });
  // jsdom lacks object-URL APIs used by the export download.
  if (!("createObjectURL" in URL)) {
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => "blob:x";
  }
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

  const realCreate = document.createElement.bind(document);
  createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = realCreate(tag) as HTMLElement;
    if (tag === "input") lastInput = el as HTMLInputElement;
    if (tag === "a") (el as HTMLAnchorElement).click = vi.fn();
    return el;
  });
});

afterEach(() => {
  createElementSpy?.mockRestore();
  lastInput = null;
});

function renderBody(section: Parameters<typeof SettingsBody>[0]["activeSection"], tasks = TASKS) {
  return render(
    <SettingsBody
      activeSection={section}
      tasks={tasks}
      tasksLoading={false}
      settings={makeSettings()}
    />,
  );
}

describe("SettingsBody", () => {
  it("renders the data section with the task-count summary", () => {
    renderBody("data");
    // 2 active + 1 done out of 3 total.
    expect(screen.getByText("3 tasks")).toBeInTheDocument();
    expect(screen.getByText("Export tasks")).toBeInTheDocument();
  });

  it("exports tasks and reports success", async () => {
    renderBody("data");
    fireEvent.click(screen.getByText("Export tasks"));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Tasks exported"));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("warns when some records were skipped during export", async () => {
    mockExport.mockResolvedValue({ json: "{}", skippedCount: 2 });
    renderBody("data");
    fireEvent.click(screen.getByText("Export tasks"));
    await waitFor(() =>
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining("2 unreadable tasks"),
      ),
    );
  });

  it("reports an error when export fails", async () => {
    mockExport.mockRejectedValue(new Error("disk full"));
    renderBody("data");
    fireEvent.click(screen.getByText("Export tasks"));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Failed to export tasks"));
  });

  it("opens the import dialog for a valid JSON file", async () => {
    renderBody("data");
    fireEvent.click(screen.getByText("Import tasks"));
    expect(lastInput).toBeTruthy();

    const file = new File(['{"tasks":[]}'], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => '{"tasks":[]}' });
    await lastInput!.onchange?.({ target: { files: [file] } } as unknown as Event);

    expect(await screen.findByTestId("import-complete")).toBeInTheDocument();

    // Completing the import surfaces a success toast.
    fireEvent.click(screen.getByTestId("import-complete"));
    expect(mockToastSuccess).toHaveBeenCalledWith("Tasks imported successfully");
  });

  it("rejects an import file larger than the limit", async () => {
    renderBody("data");
    fireEvent.click(screen.getByText("Import tasks"));
    const bigFile = { size: 11 * 1024 * 1024, text: async () => "{}" };
    await lastInput!.onchange?.({ target: { files: [bigFile] } } as unknown as Event);
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("too large"));
  });

  it("rejects a file containing invalid JSON", async () => {
    renderBody("data");
    fireEvent.click(screen.getByText("Import tasks"));
    const badFile = { size: 10, text: async () => "not json" };
    await lastInput!.onchange?.({ target: { files: [badFile] } } as unknown as Event);
    expect(mockToastError).toHaveBeenCalledWith("Invalid JSON format in import file");
  });

  it("ignores an import with no file selected", async () => {
    renderBody("data");
    fireEvent.click(screen.getByText("Import tasks"));
    await lastInput!.onchange?.({ target: { files: [] } } as unknown as Event);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("routes to sync history is not triggered, but export flows through the sync section", async () => {
    renderBody("sync");
    fireEvent.click(screen.getByTestId("sync-export"));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Tasks exported"));
  });

  it("renders each non-data section branch", () => {
    for (const [section, testid] of [
      ["appearance", "s-appearance"],
      ["features", "s-features"],
      ["notifications", "s-notifications"],
      ["archive", "s-archive"],
      ["about", "s-about"],
    ] as const) {
      const { unmount } = renderBody(section);
      expect(screen.getByTestId(testid)).toBeInTheDocument();
      unmount();
    }
  });
});
