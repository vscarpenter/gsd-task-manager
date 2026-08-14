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
        // --gray-500 (#646477) is the documented muted-text floor at 5.69:1 on
        // paper. An alpha modifier composites it to a lighter colour the token
        // system never measured: /80 lands at 3.72:1, under the AA 4.5:1 floor,
        // and it fails in light mode only — so it hides from dark-mode testing.
        expect(heading.className).toContain("text-foreground-muted");
        expect(heading.className).not.toMatch(/text-foreground-muted\/\d+/);
      }
    });
  });
});
