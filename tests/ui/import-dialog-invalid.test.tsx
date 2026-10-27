import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportDialog } from "@/components/import-dialog";
import { createMockTask } from "@/tests/fixtures";

vi.mock("@/lib/tasks", () => ({ importFromJson: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function renderWith(fileContents: string, onOpenChange = vi.fn()) {
  render(
    <ImportDialog
      open
      onOpenChange={onOpenChange}
      fileContents={fileContents}
      existingTaskCount={3}
      onImportComplete={vi.fn()}
    />
  );
  return onOpenChange;
}

describe("ImportDialog with an unusable file", () => {
  it("says it is not a backup and offers no merge or replace", () => {
    renderWith(JSON.stringify({ foo: [1, 2, 3] }));
    expect(screen.getByRole("alert")).toHaveTextContent("This is not a GSD backup file.");
    expect(screen.queryByText("Merge Tasks")).toBeNull();
    expect(screen.queryByText("Replace Everything")).toBeNull();
  });

  it("names the task and limit for an over-long title", () => {
    const tasks = [createMockTask({ id: "task-1", title: "x".repeat(10_000) })];
    renderWith(JSON.stringify({ tasks, exportedAt: "2026-10-27T12:00:00.000Z", version: "2.1.0" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Task 1: the title is too long (80 characters at most).");
  });

  it("closes from the Close button", async () => {
    const onOpenChange = renderWith("[]");
    await userEvent.click(screen.getAllByRole("button", { name: /^close$/i }).at(-1) as HTMLElement);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("tells a person that merging adds copies of tasks already on this device", () => {
    const tasks = [createMockTask({ id: "task-1" })];
    renderWith(JSON.stringify({ tasks, exportedAt: "2026-10-27T12:00:00.000Z", version: "2.1.0" }));
    expect(screen.getByText(/already on this device are added again as copies/i)).toBeInTheDocument();
  });
});
