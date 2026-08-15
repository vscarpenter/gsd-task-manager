import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsSidebar } from "@/components/settings-page/settings-sidebar";
import { SETTINGS_SECTION_IDS } from "@/components/settings-page/settings-sidebar-data";

function renderSidebar() {
  return render(
    <SettingsSidebar
      activeId="appearance"
      onSelect={vi.fn()}
      visibleSections={SETTINGS_SECTION_IDS}
    />,
  );
}

describe("SettingsSidebar", () => {
  // The sidebar ships twice — a horizontal pill row for mobile and a vertical
  // rail for desktop — and only one is visible at a time via CSS. jsdom applies
  // no stylesheet, so both are in the tree here.
  describe("landmarks", () => {
    it("exposes both the mobile and desktop navigation as named landmarks", () => {
      renderSidebar();
      const navs = screen.getAllByRole("navigation", { name: "Settings sections" });
      expect(navs).toHaveLength(2);
    });

    it("does not leave the desktop rail as an unnamed complementary region", () => {
      const { container } = renderSidebar();
      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      // Screen-reader and keyboard users navigate settings by landmark. The
      // desktop rail is where that matters most, so the <nav> has to live
      // inside the <aside>, not be replaced by it.
      expect(aside?.querySelector("nav")).not.toBeNull();
    });
  });

  describe("group label contrast", () => {
    it("renders the group headings at full muted strength, never alpha-reduced", () => {
      const { container } = renderSidebar();
      const headings = Array.from(container.querySelectorAll("p")).filter((el) =>
        ["Preferences", "Data", "Info"].includes(el.textContent?.trim() ?? ""),
      );
      expect(headings.length).toBeGreaterThan(0);

      for (const heading of headings) {
        // --gray-500 (#6E6760) is the documented muted-text floor at 5.6:1 on
        // paper. An alpha modifier composites it to a lighter colour the token
        // system never measured: /80 lands at 3.63:1, under the AA 4.5:1 floor,
        // and it fails in light mode only — so it hides from dark-mode testing.
        expect(heading.className).toContain("text-foreground-muted");
        expect(heading.className).not.toMatch(/text-foreground-muted\/\d+/);
      }
    });
  });

  describe("current-section semantics", () => {
    it("marks the active section without claiming a page navigation occurred", () => {
      renderSidebar();
      const current = screen
        .getAllByRole("button", { name: /Appearance/ })
        .map((el) => el.getAttribute("aria-current"));

      expect(current).toHaveLength(2);
      // These buttons switch a section within one route. aria-current="page"
      // tells assistive tech the user navigated to a different page when they
      // did not; "true" is the accurate token for a non-navigation selection.
      expect(current.every((value) => value === "true")).toBe(true);
    });

    it("leaves inactive sections unmarked", () => {
      renderSidebar();
      for (const el of screen.getAllByRole("button", { name: /Notifications/ })) {
        expect(el).not.toHaveAttribute("aria-current");
      }
    });
  });

  describe("mobile overflow", () => {
    it("signals that more sections exist past the right edge", () => {
      const { container } = renderSidebar();
      // Eight sections in a scroller with the scrollbar deliberately hidden.
      // Without a cue at the trailing edge, the sections past the fold are
      // discoverable only by guessing that the row scrolls at all.
      const scroller = container.querySelector("[data-testid='settings-nav-scroller']");
      expect(scroller).not.toBeNull();
      expect(scroller?.className).toMatch(/mask-/);
    });
  });
});
