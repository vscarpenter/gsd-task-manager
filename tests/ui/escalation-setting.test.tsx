import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { ESCALATION_WINDOW_KEY } from "@/lib/preferences/escalation-window";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));

describe("Escalation window setting", () => {
  afterEach(() => window.localStorage.removeItem(ESCALATION_WINDOW_KEY));

  function renderSetting() {
    render(<AppearanceSettings showCompleted={false} onToggleCompleted={vi.fn()} />);
    return screen.getByRole("combobox", { name: "Escalate tasks due within" });
  }

  it("sits in Appearance with its helper text and defaults to 2 days", () => {
    const select = renderSetting();
    expect(select).toHaveValue("2");
    expect(
      screen.getByText(
        "Flags tasks that aren't marked urgent when their due date gets this close. Nothing moves until you say so."
      )
    ).toBeInTheDocument();
  });

  it("offers Off, 1 day, 2 days, 3 days, 1 week", () => {
    const labels = Array.from(renderSetting().querySelectorAll("option")).map((o) => o.textContent);
    expect(labels).toEqual(["Off", "1 day", "2 days", "3 days", "1 week"]);
  });

  it.each([
    ["off", "off"],
    ["1", "1"],
    ["7", "7"],
  ])("stores %s when chosen", async (value, stored) => {
    await userEvent.selectOptions(renderSetting(), value);
    expect(window.localStorage.getItem(ESCALATION_WINDOW_KEY)).toBe(stored);
  });
});
