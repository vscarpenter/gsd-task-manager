import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { WhatsNewCue } from "@/components/matrix-simplified/whats-new-cue";
import {
  WHATS_NEW_LAST_SEEN_KEY,
  readLastSeenVersion,
  recordLastSeenVersion,
} from "@/lib/whats-new/last-seen";
import type { WhatsNewRelease } from "@/lib/whats-new/releases";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    // Run the component's handler, then stop jsdom's "navigation to another Document".
    <a href={href} {...rest} onClick={(event) => { onClick?.(event); event.preventDefault(); }}>
      {children}
    </a>
  ),
}));

const RELEASES: WhatsNewRelease[] = [
  { platform: "web", version: "1.1.0", date: "2026-02-01", notable: true, headline: "Save any web page to GSD.", new: ["x"], improved: [], fixed: [] },
  { platform: "web", version: "1.0.1", date: "2026-01-15", notable: false, headline: null, new: [], improved: [], fixed: ["y"] },
  { platform: "web", version: "1.0.0", date: "2026-01-01", notable: true, headline: "First.", new: ["z"], improved: [], fixed: [] },
];

describe("WhatsNewCue", () => {
  beforeEach(() => {
    localStorage.removeItem(WHATS_NEW_LAST_SEEN_KEY);
    vi.stubEnv("NEXT_PUBLIC_BUILD_NUMBER", "1.1.0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the newest notable headline to an existing user after an update", () => {
    recordLastSeenVersion("1.0.0");
    render(<WhatsNewCue existingUser releases={RELEASES} />);
    expect(screen.getByTestId("whats-new-cue")).toHaveTextContent("New in 1.1.0: Save any web page to GSD.");
    expect(screen.getByRole("link", { name: "See what’s new" })).toHaveAttribute("href", "/settings#whats-new");
  });

  it("never shows to a new user, and starts them from the running version", () => {
    render(<WhatsNewCue existingUser={false} releases={RELEASES} />);
    expect(screen.queryByTestId("whats-new-cue")).toBeNull();
    expect(readLastSeenVersion()).toBe("1.1.0");
  });

  it("waits while tasks are still loading", () => {
    render(<WhatsNewCue existingUser={null} releases={RELEASES} />);
    expect(screen.queryByTestId("whats-new-cue")).toBeNull();
    expect(readLastSeenVersion()).toBeNull();
  });

  it("hides and records the running version on Dismiss", () => {
    recordLastSeenVersion("1.0.0");
    render(<WhatsNewCue existingUser releases={RELEASES} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss what's new" }));
    expect(screen.queryByTestId("whats-new-cue")).toBeNull();
    expect(readLastSeenVersion()).toBe("1.1.0");
  });

  it("records the running version when the link is followed", () => {
    recordLastSeenVersion("1.0.0");
    render(<WhatsNewCue existingUser releases={RELEASES} />);
    fireEvent.click(screen.getByRole("link", { name: "See what’s new" }));
    expect(readLastSeenVersion()).toBe("1.1.0");
  });

  it("hides when another tab records the version", () => {
    recordLastSeenVersion("1.0.0");
    render(<WhatsNewCue existingUser releases={RELEASES} />);
    act(() => recordLastSeenVersion("1.1.0"));
    expect(screen.queryByTestId("whats-new-cue")).toBeNull();
  });

  it("stays quiet after a patch-only update", () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_NUMBER", "1.0.1");
    recordLastSeenVersion("1.0.0");
    render(<WhatsNewCue existingUser releases={RELEASES} />);
    expect(screen.queryByTestId("whats-new-cue")).toBeNull();
    expect(readLastSeenVersion()).toBe("1.0.1");
  });
});
