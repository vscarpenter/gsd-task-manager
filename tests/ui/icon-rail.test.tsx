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
    const desktopNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(desktopNav.className).toContain("md:w-[180px]");
    expect(desktopNav.className).not.toContain("md:w-[60px]");
  });

  it("renders collapsed when localStorage preference is set", () => {
    localStorage.setItem(RAIL_COLLAPSED_KEY, "true");
    render(<IconRail onHelp={vi.fn()} />);
    const desktopNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(desktopNav.className).toContain("md:w-[60px]");
    expect(desktopNav.className).not.toContain("md:w-[180px]");
  });

  it("toggles between expanded and collapsed when the toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<IconRail onHelp={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });
    await user.click(toggle);

    const desktopNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(desktopNav.className).toContain("md:w-[60px]");
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("true");

    const expand = screen.getByRole("button", { name: /expand sidebar/i });
    await user.click(expand);
    expect(desktopNav.className).toContain("md:w-[180px]");
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("false");
  });

  it("does not include hover-driven auto-expansion classes", () => {
    render(<IconRail onHelp={vi.fn()} />);
    const desktopNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(desktopNav.className).not.toContain("hover:w-");
    expect(desktopNav.className).not.toContain("focus-within:w-");
    expect(desktopNav.className).not.toContain("transition-delay:500ms");
  });

  it("gives every mobile navigation action a coarse-pointer touch target", () => {
    render(<IconRail onHelp={vi.fn()} />);
    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });

    for (const button of mobileNav.querySelectorAll("button")) {
      expect(button).toHaveClass("touch-target");
    }
  });

  it("uses the global accent for active navigation on desktop and mobile", () => {
    render(<IconRail onHelp={vi.fn()} />);

    const matrixButtons = screen.getAllByRole("button", { name: "Matrix" });
    expect(matrixButtons).toHaveLength(2);
    for (const button of matrixButtons) {
      const icon = button.querySelector("svg");
      expect(icon).toHaveClass("text-accent");
      expect(icon).not.toHaveClass("text-q1");
      expect(button.className).toMatch(/before:bg-accent|after:bg-accent/);
    }
  });

  it("gives desktop rail actions coarse-pointer touch targets", () => {
    render(<IconRail onHelp={vi.fn()} />);
    const desktopNav = screen.getByRole("navigation", { name: "Primary navigation" });

    for (const button of desktopNav.querySelectorAll("button")) {
      expect(button).toHaveClass("touch-target");
    }
  });

  it("uses Review vocabulary and keeps mobile destinations visibly labelled", () => {
    render(<IconRail onHelp={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: "Review" })).toHaveLength(2);
    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
    expect(mobileNav).toHaveClass("pb-[max(0.375rem,env(safe-area-inset-bottom))]");
    expect(mobileNav).toHaveClass(
      "pl-[max(0.5rem,env(safe-area-inset-left))]",
      "pr-[max(0.5rem,env(safe-area-inset-right))]"
    );
    for (const label of ["Matrix", "Review", "Settings", "About", "Help"]) {
      expect(mobileNav.querySelector(`button[aria-label="${label}"] span`)).toHaveTextContent(label);
    }
  });
});
