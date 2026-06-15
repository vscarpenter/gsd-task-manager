import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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
});
