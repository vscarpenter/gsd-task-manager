import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Onboarding } from "@/components/onboarding/onboarding";

function renderOnboarding(props?: Partial<React.ComponentProps<typeof Onboarding>>) {
  const onClose = vi.fn();
  const onSignIn = vi.fn();
  render(<Onboarding open onClose={onClose} onSignIn={onSignIn} {...props} />);
  return { onClose, onSignIn };
}

describe("Onboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not render when closed", () => {
    const onClose = vi.fn();
    render(<Onboarding open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the welcome screen with a Skip control", () => {
    renderOnboarding();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Get the right things done/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("advances through all four screens to the final privacy screen", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    // 3 Next presses → screen 4
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("button", { name: /start using gsd/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to sync/i })).toBeInTheDocument();
  });

  it("calls onClose when Skip is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderOnboarding();
    await user.click(screen.getByRole("button", { name: /skip/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Start using GSD is pressed on the last screen", async () => {
    const user = userEvent.setup();
    const { onClose } = renderOnboarding();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /start using gsd/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSignIn from the final screen's secondary action", async () => {
    const user = userEvent.setup();
    const { onSignIn } = renderOnboarding();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /sign in to sync/i }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it("traps focus within the onboarding dialog", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    const skip = screen.getByRole("button", { name: /skip/i });
    const next = screen.getByRole("button", { name: /next/i });

    next.focus();
    await user.tab();
    expect(skip).toHaveFocus();

    await user.tab({ shift: true });
    expect(next).toHaveFocus();
  });

});
