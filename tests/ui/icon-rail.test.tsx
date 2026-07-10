import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconRail } from "@/components/matrix-simplified/icon-rail";
import { RAIL_COLLAPSED_KEY } from "@/lib/preferences/icon-rail";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/use-view-transition", () => ({
  useViewTransition: () => ({
    navigateWithTransition: vi.fn(),
    isPending: false,
  }),
}));

describe("IconRail", () => {
  beforeEach(() => {
    localStorage.removeItem(RAIL_COLLAPSED_KEY);
  });

  it("renders expanded by default with visible labels", () => {
    render(<IconRail onHelp={vi.fn()} />);
    const aside = screen.getByRole("complementary", { name: /primary navigation/i });
    expect(aside.className).toContain("md:w-[180px]");
    expect(aside.className).not.toContain("md:w-[60px]");
  });

  it("renders collapsed when localStorage preference is set", () => {
    localStorage.setItem(RAIL_COLLAPSED_KEY, "true");
    render(<IconRail onHelp={vi.fn()} />);
    const aside = screen.getByRole("complementary", { name: /primary navigation/i });
    expect(aside.className).toContain("md:w-[60px]");
    expect(aside.className).not.toContain("md:w-[180px]");
  });

  it("toggles between expanded and collapsed when the toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<IconRail onHelp={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });
    await user.click(toggle);

    const aside = screen.getByRole("complementary", { name: /primary navigation/i });
    expect(aside.className).toContain("md:w-[60px]");
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("true");

    const expand = screen.getByRole("button", { name: /expand sidebar/i });
    await user.click(expand);
    expect(aside.className).toContain("md:w-[180px]");
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("false");
  });

  it("does not include hover-driven auto-expansion classes", () => {
    render(<IconRail onHelp={vi.fn()} />);
    const aside = screen.getByRole("complementary", { name: /primary navigation/i });
    expect(aside.className).not.toContain("hover:w-");
    expect(aside.className).not.toContain("focus-within:w-");
    expect(aside.className).not.toContain("transition-delay:500ms");
  });

  it("gives every mobile navigation action a coarse-pointer touch target", () => {
    render(<IconRail onHelp={vi.fn()} />);
    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });

    for (const button of mobileNav.querySelectorAll("button")) {
      expect(button).toHaveClass("touch-target");
    }
  });
});
