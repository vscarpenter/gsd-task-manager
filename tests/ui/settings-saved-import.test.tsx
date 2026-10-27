import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/settings-page";

const { importTasks } = vi.hoisted(() => ({ importTasks: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({
    all: [],
    stored: [{ id: "saved-only", title: "Read later", savedAt: "2026-10-26T00:00:00Z", completed: false }],
    isLoading: false,
  }),
}));
vi.mock("@/components/settings-page/use-settings-data", () => ({
  useSettingsData: () => ({ dataLoaded: true, syncEnabled: true, pendingSync: 0 }),
}));
vi.mock("@/components/settings-page/use-active-section", () => ({
  useActiveSection: () => ({ activeSection: "data", visibleSectionIds: ["data"], selectSection: vi.fn() }),
}));
vi.mock("@/lib/tasks", () => ({ importFromJson: importTasks }));
vi.mock("@/lib/tasks/import-check", () => ({ checkImportFile: () => ({ ok: true }) }));

describe("Saved records in Settings", () => {
  it("counts Saved-only storage and asks before a synced import deletes it", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText("1 tasks")).toBeInTheDocument();
    expect(screen.getByText("Active:")).toHaveTextContent("Active: 0");
    expect(screen.getByText("Saved:")).toHaveTextContent("Saved: 1");
    fireEvent.click(screen.getByText("Reset everything"));
    expect(await screen.findByText(/1 task \(0 active, 0 completed, 1 saved\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));

    const createElement = document.createElement.bind(document);
    let fileInput: HTMLInputElement | undefined;
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === "input") fileInput = element as HTMLInputElement;
      return element;
    });
    fireEvent.click(screen.getByText("Import tasks"));
    spy.mockRestore();
    const contents = JSON.stringify({ tasks: [{ id: "incoming", title: "New task" }] });
    fireEvent.change(fileInput!, { target: { files: [{ text: async () => contents, size: contents.length }] } });

    expect(await screen.findByText(/warning\. deletes 1 task on this device/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Replace Everything"));
    expect(await screen.findByText(/delete these tasks from your account/i)).toBeInTheDocument();
    expect(importTasks).not.toHaveBeenCalled();
  });
});
