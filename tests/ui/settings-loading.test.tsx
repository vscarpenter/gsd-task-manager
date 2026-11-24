import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { SettingsPage } from "@/components/settings-page";
import { createMockNotificationSettings } from "@/tests/fixtures";
import { getNotificationSettings } from "@/lib/notifications";

vi.mock("@/lib/use-tasks", () => ({
  useTasks: () => ({ stored: [], isLoading: false }),
}));
vi.mock("@/lib/notifications", () => ({
  getNotificationSettings: vi.fn(),
}));
vi.mock("@/lib/sync/config", () => ({
  getSyncStatus: () => Promise.resolve({ enabled: false, pendingCount: 0 }),
}));
vi.mock("@/lib/smart-views", () => ({
  getAppPreferences: () => Promise.resolve(null),
}));
vi.mock("@/components/settings-page/settings-body", () => ({
  SettingsBody: () => <h2>Appearance settings</h2>,
}));

it("shows a retry action after a settings read fails and renders after retry", async () => {
  vi.mocked(getNotificationSettings)
    .mockRejectedValueOnce(new Error("Local settings unavailable"))
    .mockResolvedValueOnce(createMockNotificationSettings());
  const user = userEvent.setup();
  render(<SettingsPage />);

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load settings.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Appearance settings" })).toBeInTheDocument();
});
