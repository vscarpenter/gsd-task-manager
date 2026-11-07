import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SweepReminderRows } from "@/components/settings/sweep-reminder-rows";
import { SWEEP_REMINDER_KEY, readSweepReminder } from "@/lib/preferences/weekly-sweep";

vi.mock("@/lib/notifications", () => ({
  checkNotificationPermission: vi.fn(() => "granted"),
  requestNotificationPermission: vi.fn(async () => true),
}));

describe("SweepReminderRows", () => {
  beforeEach(() => localStorage.removeItem(SWEEP_REMINDER_KEY));

  it("always offers a way to start the sweep", () => {
    render(<SweepReminderRows />);

    expect(screen.getByRole("link", { name: "Start weekly sweep" })).toHaveAttribute("href", "/sweep");
  });

  it("starts off, and says what it does and doesn't do", () => {
    render(<SweepReminderRows />);

    expect(screen.getByRole("switch", { name: "Weekly sweep reminder" })).not.toBeChecked();
    expect(screen.getByText(/Works while GSD is open/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Day")).toBeNull();
  });

  it("turning it on starts at Sunday 09:00 and reveals day and time", async () => {
    const user = userEvent.setup();
    render(<SweepReminderRows />);

    await user.click(screen.getByRole("switch", { name: "Weekly sweep reminder" }));

    expect(readSweepReminder()).toEqual({ enabled: true, weekday: 7, time: "09:00" });
    expect((screen.getByLabelText("Day") as HTMLSelectElement).value).toBe("7");
    expect((screen.getByLabelText("Time") as HTMLInputElement).value).toBe("09:00");
  });

  it("saves a new day and time", async () => {
    const user = userEvent.setup();
    render(<SweepReminderRows />);
    await user.click(screen.getByRole("switch", { name: "Weekly sweep reminder" }));

    await user.selectOptions(screen.getByLabelText("Day"), "1");
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "07:30" } });

    expect(readSweepReminder()).toEqual({ enabled: true, weekday: 1, time: "07:30" });
  });

  it("turning it off keeps the chosen day and time for next time", async () => {
    const user = userEvent.setup();
    render(<SweepReminderRows />);
    await user.click(screen.getByRole("switch", { name: "Weekly sweep reminder" }));
    await user.selectOptions(screen.getByLabelText("Day"), "3");

    await user.click(screen.getByRole("switch", { name: "Weekly sweep reminder" }));

    expect(readSweepReminder().enabled).toBe(false);
    expect(JSON.parse(localStorage.getItem(SWEEP_REMINDER_KEY)!).weekday).toBe(3);
  });

  it("asks for permission the first time it's turned on", async () => {
    const notifications = await import("@/lib/notifications");
    vi.mocked(notifications.checkNotificationPermission).mockReturnValueOnce("default");
    const user = userEvent.setup();
    render(<SweepReminderRows />);

    await user.click(screen.getByRole("switch", { name: "Weekly sweep reminder" }));

    expect(notifications.requestNotificationPermission).toHaveBeenCalled();
  });
});
