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

  it("lets its title speak without an eyebrow above it", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.queryByText("Field guide")).toBeNull();
  });

  it("sets its title upright, since the serif ships no italic for the browser to use", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    const title = screen.getByRole("heading", { name: "How to use GSD" });
    expect(title.querySelector("em, i")).toBeNull();
  });

  it("describes the sync badges by what they show, not by color", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    const help = screen.getByTestId("help-drawer-scroll");
    expect(help).not.toHaveTextContent(/aubergine|coral/i);
    expect(help).toHaveTextContent("A number on the icon counts changes waiting to sync.");
    expect(help).toHaveTextContent("An exclamation mark means your session expired. Click the icon to sign in again.");
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

  it("points to the feedback section so the form is discoverable without a prompt", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Send feedback" })).toHaveAttribute(
      "href",
      "/settings#feedback"
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

describe("HelpDrawer plain wording", () => {
  it("points sync at the cloud icon and names who runs the server", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("The cloud icon at the top is your sync control.");
    expect(help).toHaveTextContent("a server run by GSD\u2019s developer");
    expect(help).not.toHaveTextContent(/PocketBase|self-hosted/i);
  });

  it("describes the capture bar and the quadrant pill by where they are", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("Every task starts in the Add a task bar.");
    expect(help).toHaveTextContent("quadrant pill at the right end of the bar");
    expect(help).not.toHaveTextContent(/checkbox|reclassify|spawn|hijack|activation distance/i);
  });

  it("documents the touch swipe actions and labels the shortcuts as keyboard tips", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("swipe a task right to complete it");
    expect(help).toHaveTextContent("Swipe left to snooze it for 1 hour or delete it");
    expect(screen.getByRole("heading", { name: "Keyboard tips" })).toBeInTheDocument();
  });
});
