import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingGate, REPLAY_ONBOARDING_EVENT, ONBOARDING_SEEN_KEY } from "@/components/onboarding/onboarding-gate";

const pushMock = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: pushMock }),
}));

describe("OnboardingGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(ONBOARDING_SEEN_KEY);
    pathname = "/";
  });

  it("auto-opens for a first-time visitor on the app", () => {
    render(<OnboardingGate />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not auto-open once the tour has been seen", () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    render(<OnboardingGate />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not auto-open on the marketing /about route", () => {
    pathname = "/about";
    render(<OnboardingGate />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("re-opens when the replay event fires, even after being seen", () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    render(<OnboardingGate />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event(REPLAY_ONBOARDING_EVENT));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dismisses an automatic first-run tour immediately when Skip is pressed", async () => {
    const user = userEvent.setup();
    render(<OnboardingGate />);

    await user.click(screen.getByRole("button", { name: /skip/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe("true");
  });

  it("dismisses an automatic first-run tour immediately with Escape", async () => {
    const user = userEvent.setup();
    render(<OnboardingGate />);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses the final screen immediately when Start using GSD is pressed", async () => {
    const user = userEvent.setup();
    render(<OnboardingGate />);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /start using gsd/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores focus to the control that requested a replay", async () => {
    const user = userEvent.setup();
    localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    render(
      <>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(REPLAY_ONBOARDING_EVENT))}
        >
          Replay welcome tour
        </button>
        <OnboardingGate />
      </>
    );
    const trigger = screen.getByRole("button", { name: /replay welcome tour/i });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /skip/i }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
