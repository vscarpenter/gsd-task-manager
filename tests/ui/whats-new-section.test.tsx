import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WhatsNewSection } from "@/components/settings/whats-new-section";
import { WHATS_NEW_LAST_SEEN_KEY, readLastSeenVersion } from "@/lib/whats-new/last-seen";
import type { WhatsNewRelease } from "@/lib/whats-new/releases";

const RELEASES: WhatsNewRelease[] = [
  { platform: "web", version: "2.0.0", date: "2026-03-01", notable: true, headline: "Not shipped yet.", new: ["Future"], improved: [], fixed: [] },
  { platform: "web", version: "1.1.0", date: "2026-02-01", notable: true, headline: "Bookmarklet arrives.", new: ["Save any page"], improved: ["Faster sync"], fixed: ["No duplicate tasks"] },
  { platform: "apple", version: "1.1.5", date: "2026-02-02", notable: true, headline: "Apple only.", new: ["Widgets"], improved: [], fixed: [] },
  { platform: "web", version: "1.0.1", date: "2026-01-15", notable: false, headline: null, new: [], improved: [], fixed: ["Reminders fire"] },
];

describe("WhatsNewSection", () => {
  beforeEach(() => {
    localStorage.removeItem(WHATS_NEW_LAST_SEEN_KEY);
    vi.stubEnv("NEXT_PUBLIC_BUILD_NUMBER", "1.1.0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists this build's web releases, newest first", () => {
    render(<WhatsNewSection releases={RELEASES} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Version 1.1.0", "Version 1.0.1"]);
    expect(screen.queryByText("Apple only.")).toBeNull();
    expect(screen.queryByText("Not shipped yet.")).toBeNull();
  });

  it("shows the date in English and the headline", () => {
    render(<WhatsNewSection releases={RELEASES} />);
    expect(screen.getByText("February 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Bookmarklet arrives.")).toBeInTheDocument();
  });

  it("groups items under New, Improved, and Fixed, and leaves out empty groups", () => {
    render(<WhatsNewSection releases={RELEASES} />);
    const latest = screen.getByRole("region", { name: "Version 1.1.0" });
    expect(within(latest).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "New",
      "Improved",
      "Fixed",
    ]);
    expect(within(latest).getByText("Save any page")).toBeInTheDocument();

    const patch = screen.getByRole("region", { name: "Version 1.0.1" });
    expect(within(patch).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["Fixed"]);
  });

  it("records the running version as seen when opened", () => {
    render(<WhatsNewSection releases={RELEASES} />);
    expect(readLastSeenVersion()).toBe("1.1.0");
  });

  it("says so when this build has no notes", () => {
    render(<WhatsNewSection releases={[]} />);
    expect(screen.getByText(/No release notes for this version yet/)).toBeInTheDocument();
  });
});
