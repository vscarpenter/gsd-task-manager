import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/toast";

function ToastTrigger() {
  const { showToast } = useToast();
  return <button onClick={() => showToast("Saved", undefined, 0)}>Show toast</button>;
}

describe("ToastProvider", () => {
  it("announces toast messages politely", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Show toast" }));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("Saved");
  });
});
