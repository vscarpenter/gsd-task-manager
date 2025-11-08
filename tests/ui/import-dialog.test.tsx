import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportDialog } from "@/components/import-dialog";

// Mock the tasks module
const mockImportFromJson = vi.fn();

vi.mock("@/lib/tasks", () => ({
  importFromJson: (raw: string, mode: "replace" | "merge") => mockImportFromJson(raw, mode)
}));

describe("ImportDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnImportComplete = vi.fn();

  const validJsonContent = JSON.stringify({
    tasks: [
      { id: "1", title: "Task 1", urgent: true, important: true },
      { id: "2", title: "Task 2", urgent: false, important: true }
    ],
    exportedAt: "2024-01-01T00:00:00.000Z",
    version: "1.0.0"
  });

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    fileContents: validJsonContent,
    existingTaskCount: 5,
    onImportComplete: mockOnImportComplete
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockImportFromJson.mockResolvedValue(undefined);
  });

  it("renders dialog when open", () => {
    render(<ImportDialog {...defaultProps} />);

    expect(screen.getByText("Import Tasks")).toBeInTheDocument();
    expect(screen.getByText(/choose how to import/i)).toBeInTheDocument();
  });

  it("does not render dialog when closed", () => {
    render(<ImportDialog {...defaultProps} open={false} />);

    expect(screen.queryByText("Import Tasks")).not.toBeInTheDocument();
  });

  it("displays existing task count", () => {
    render(<ImportDialog {...defaultProps} />);

    expect(screen.getByText(/you currently have/i)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("displays import task count from parsed JSON", () => {
    render(<ImportDialog {...defaultProps} />);

    expect(screen.getByText(/importing/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("handles singular task count text", () => {
    const singleTaskJson = JSON.stringify({
      tasks: [{ id: "1", title: "Task 1" }],
      exportedAt: "2024-01-01T00:00:00.000Z",
      version: "1.0.0"
    });

    render(<ImportDialog {...defaultProps} fileContents={singleTaskJson} existingTaskCount={1} />);

    // Should show singular "task" not "tasks"
    const text = screen.getByText(/you currently have/i).textContent;
    expect(text).toContain("1 task");
    expect(text).not.toContain("1 tasks");
  });

  it("renders merge option button", () => {
    render(<ImportDialog {...defaultProps} />);

    expect(screen.getByText("Merge Tasks")).toBeInTheDocument();
    expect(screen.getByText(/keep your existing tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/safe - no data loss/i)).toBeInTheDocument();
  });

  it("renders replace option button", () => {
    render(<ImportDialog {...defaultProps} />);

    expect(screen.getByText("Replace All Tasks")).toBeInTheDocument();
    expect(screen.getByText(/delete all existing tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/warning - deletes 5 existing/i)).toBeInTheDocument();
  });

  it("renders cancel button", () => {
    render(<ImportDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls importFromJson with merge mode when merge button clicked", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Merge Tasks"));

    await waitFor(() => {
      expect(mockImportFromJson).toHaveBeenCalledWith(validJsonContent, "merge");
    });
  });

  it("calls importFromJson with replace mode when replace button clicked", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Replace All Tasks"));

    await waitFor(() => {
      expect(mockImportFromJson).toHaveBeenCalledWith(validJsonContent, "replace");
    });
  });

  it("calls onImportComplete after successful merge", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Merge Tasks"));

    await waitFor(() => {
      expect(mockOnImportComplete).toHaveBeenCalled();
    });
  });

  it("calls onImportComplete after successful replace", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Replace All Tasks"));

    await waitFor(() => {
      expect(mockOnImportComplete).toHaveBeenCalled();
    });
  });

  it("closes dialog after successful import", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Merge Tasks"));

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("disables buttons while importing", async () => {
    const user = userEvent.setup();
    let resolveImport: (value: unknown) => void;
    mockImportFromJson.mockImplementation(() => new Promise(resolve => { resolveImport = resolve; }));

    render(<ImportDialog {...defaultProps} />);

    const mergeButton = screen.getByText("Merge Tasks").closest("button");
    const replaceButton = screen.getByText("Replace All Tasks").closest("button");
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    await user.click(mergeButton!);

    await waitFor(() => {
      expect(mergeButton).toBeDisabled();
      expect(replaceButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    resolveImport!(undefined);

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows alert on import error", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockImportFromJson.mockRejectedValue(new Error("Import failed"));

    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Merge Tasks"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Import failed. Ensure you selected a valid export file.");
    });

    alertSpy.mockRestore();
  });

  it("does not close dialog on import error", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockImportFromJson.mockRejectedValue(new Error("Import failed"));

    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByText("Merge Tasks"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    expect(mockOnOpenChange).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("re-enables buttons after import error", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockImportFromJson.mockRejectedValue(new Error("Import failed"));

    render(<ImportDialog {...defaultProps} />);

    const mergeButton = screen.getByText("Merge Tasks").closest("button");

    await user.click(mergeButton!);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    // Buttons should be re-enabled after error
    expect(mergeButton).not.toBeDisabled();

    alertSpy.mockRestore();
  });

  it("handles invalid JSON in fileContents gracefully", () => {
    const invalidJson = "{ invalid json }";

    render(<ImportDialog {...defaultProps} fileContents={invalidJson} />);

    // Should still render but without task count
    expect(screen.getByText("Import Tasks")).toBeInTheDocument();
    expect(screen.getByText(/choose how to import these task/i)).toBeInTheDocument();
  });

  it("handles null fileContents", () => {
    render(<ImportDialog {...defaultProps} fileContents={null} />);

    expect(screen.getByText("Import Tasks")).toBeInTheDocument();
  });

  it("does not call importFromJson when fileContents is null", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} fileContents={null} />);

    await user.click(screen.getByText("Merge Tasks"));

    // Should not call import when no file contents
    expect(mockImportFromJson).not.toHaveBeenCalled();
  });

  it("calls onOpenChange when cancel button clicked", async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("displays correct warning text for replace with multiple tasks", () => {
    render(<ImportDialog {...defaultProps} existingTaskCount={10} />);

    expect(screen.getByText(/warning - deletes 10 existing tasks/i)).toBeInTheDocument();
  });

  it("displays correct warning text for replace with single task", () => {
    render(<ImportDialog {...defaultProps} existingTaskCount={1} />);

    expect(screen.getByText(/warning - deletes 1 existing task/i)).toBeInTheDocument();
  });

  it("handles empty tasks array in JSON", () => {
    const emptyTasksJson = JSON.stringify({
      tasks: [],
      exportedAt: "2024-01-01T00:00:00.000Z",
      version: "1.0.0"
    });

    render(<ImportDialog {...defaultProps} fileContents={emptyTasksJson} />);

    expect(screen.getByText(/importing/i)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles JSON without tasks property", () => {
    const noTasksJson = JSON.stringify({
      exportedAt: "2024-01-01T00:00:00.000Z",
      version: "1.0.0"
    });

    render(<ImportDialog {...defaultProps} fileContents={noTasksJson} />);

    // Should handle gracefully and show "0 tasks"
    expect(screen.getByText(/choose how to import/i)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
