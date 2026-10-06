import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBackup, runBackupExport } from "@/lib/backup-download";

/**
 * runBackupExport is the export the command palette runs. A record left out of
 * someone's backup has to be reported to them, never dropped quietly.
 */

const { exportMock, toastMock } = vi.hoisted(() => ({
  exportMock: vi.fn(),
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/tasks", () => ({ exportToJsonWithReport: exportMock }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

describe("runBackupExport", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom lacks object-URL APIs and can't follow a download link.
    if (!("createObjectURL" in URL)) {
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = () => "blob:x";
    }
    if (!("revokeObjectURL" in URL)) {
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads the file and warns how many unreadable records it left out", async () => {
    exportMock.mockResolvedValue({ json: "{}", skippedCount: 2 });

    await expect(runBackupExport()).resolves.toBe(true);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toastMock.warning).toHaveBeenCalledWith(
      "Exported, but 2 unreadable records could not be included."
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("uses the singular when one record was left out", async () => {
    exportMock.mockResolvedValue({ json: "{}", skippedCount: 1 });

    await runBackupExport();

    expect(toastMock.warning).toHaveBeenCalledWith(
      "Exported, but 1 unreadable record could not be included."
    );
  });

  it("confirms a complete export", async () => {
    exportMock.mockResolvedValue({ json: "{}", skippedCount: 0 });

    await expect(runBackupExport()).resolves.toBe(true);

    expect(toastMock.success).toHaveBeenCalledWith("Tasks exported");
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it("reports a failed export and counts nothing as skipped", async () => {
    exportMock.mockRejectedValue(new Error("disk full"));

    await expect(runBackupExport()).resolves.toBe(false);
    await expect(downloadBackup()).resolves.toEqual({ ok: false, skippedCount: 0 });

    expect(toastMock.error).toHaveBeenCalledWith("Failed to export tasks");
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
