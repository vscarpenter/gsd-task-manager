import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HelpDrawer } from "@/components/matrix-simplified/help-drawer";

describe("HelpDrawer", () => {
  it("exposes a named modal dialog", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: /how to use gsd/i })).toHaveAttribute(
      "aria-modal",
      "true"
    );
  });

  it("documents native Tab order for the capture destination control", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.getByTestId("help-drawer-scroll")).toHaveTextContent(
      "press Tab to reach the destination control, then use Enter or Space to cycle it manually"
    );
    expect(screen.getByTestId("help-drawer-scroll")).not.toHaveTextContent(
      "press Tab to cycle the destination manually"
    );
  });

  it("keeps its header, scroll region, close control, and bottom edge inside device safe areas", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: /how to use gsd/i });
    expect(dialog.className).toContain("safe-area-inset-top");
    expect(dialog.className).toContain("[&>button]:right-[max(1rem,env(safe-area-inset-right))]");
    expect(dialog.querySelector("header")?.className).toContain("safe-area-inset-left");
    expect(screen.getByTestId("help-drawer-scroll").className).toContain("safe-area-inset-bottom");
    expect(screen.getByTestId("help-drawer-scroll").className).toContain("safe-area-inset-right");
  });

  it("contains focus and restores it to the opener after Escape", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open help
          </button>
          <HelpDrawer open={open} onClose={() => setOpen(false)} />
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open help" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: /how to use gsd/i });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("falls back to main content when the saved opener disappears", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <main id="main-content" tabIndex={-1}>Workspace</main>
          {!open ? (
            <button type="button" onClick={() => setOpen(true)}>
              Open transient help
            </button>
          ) : null}
          <HelpDrawer open={open} onClose={() => setOpen(false)} />
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open transient help" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
  });

  it("documents recurrence now that the composer can set it", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    expect(document.body.textContent).toMatch(/recurring tasks automatically/i);
  });
});
