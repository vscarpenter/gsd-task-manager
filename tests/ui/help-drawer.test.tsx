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

  it("carries the Field Guide eyebrow every client shares (DOC-1)", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.getByText("Field Guide")).toBeInTheDocument();
    // The eyebrow sits outside the title, so the dialog keeps its name.
    expect(screen.getByRole("dialog", { name: "How to use GSD" })).toBeInTheDocument();
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

  it("documents native Tab order for the quadrant button", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.getByTestId("help-drawer-scroll")).toHaveTextContent(
      "press Tab to reach the quadrant button, then press Enter or Space to change it"
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

  it("describes the Add a task bar and the quadrant button by where they are", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("Every task starts in the Add a task bar.");
    expect(help).toHaveTextContent("quadrant button that appears in the bar as you type");
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

describe("HelpDrawer shared outline", () => {
  const sectionOrder = [
    "The matrix",
    "Adding a task",
    "Due dates and reminders",
    "Escalating",
    "Working with a task",
    "Saved",
    "Undo, Trash, and Archive",
    "Finding things",
    "Review",
    "Getting tasks in from elsewhere",
    "Cloud sync (optional)",
    "Keyboard tips",
    "Your data",
    "Feedback",
  ];

  it("follows the shared Field Guide section order", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

    expect(headings).toEqual(sectionOrder);
  });

  it("explains Saved and links to it", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("Choose Move to Saved from a task\u2019s ⋯ menu.");
    expect(help).toHaveTextContent("Return to matrix");
    expect(help).toHaveTextContent("they don\u2019t send reminders");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
  });

  it("lists the card menu and every snooze preset", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("Move to Saved, Move to (pick a quadrant), Share, Duplicate, Snooze, and Delete");
    expect(help).toHaveTextContent(
      "15 minutes, 30 minutes, 1 hour, 3 hours, Tomorrow (a day from now), Next week (a week from now), and Clear snooze"
    );
    expect(help).toHaveTextContent("hover a task to see the main actions as icons");
  });

  it("explains due dates, All day, all-day reminders, quiet hours, and background checks", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("This week (Friday), Next week (Monday)");
    expect(help).toHaveTextContent("A due date is All day unless you turn All day off and set a time.");
    expect(help).toHaveTextContent("An all-day task reminds you at 9:00 on its due day.");
    expect(help).toHaveTextContent("A reminder that lands in quiet hours waits until they end.");
    expect(help).toHaveTextContent("Installed as an app in Chrome or Edge, GSD can also check in the background.");
    expect(help).not.toHaveTextContent(/push notification/i);
  });

  it("explains escalation and where to change it", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("its card says Escalating");
    expect(help).toHaveTextContent("Nothing moves on its own.");
    expect(help).toHaveTextContent("Settings › Appearance");
  });

  it("covers paste, links, the Android share sheet, and the bookmarklet", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("Paste several lines to add up to 20 tasks at once");
    expect(help).toHaveTextContent("A link you type moves into the task\u2019s description.");
    expect(help).toHaveTextContent("On Android, install GSD from Chrome, then share a page to GSD");
    expect(help).toHaveTextContent("Settings › Bookmarklet");
  });

  it("covers Undo, Trash, Archive, Review, the timer, and the sign-in lifetime", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("A deleted task stays in Trash for 30 days");
    expect(help).toHaveTextContent("after 30, 60, or 90 days");
    expect(help).toHaveTextContent("shows what you finished, your streak");
    expect(help).toHaveTextContent("a timer appears on its card");
    expect(help).toHaveTextContent("as long as you open GSD at least once every 30 days");
  });

  it("describes the palette by what it searches and names the Windows and Linux keys", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);
    const help = screen.getByTestId("help-drawer-scroll");

    expect(help).toHaveTextContent("searches tasks, views, and actions");
    expect(help).toHaveTextContent("On Windows and Linux, use Ctrl instead of ⌘ and Alt instead of ⌥.");
  });

  it("says reset clears only this browser", () => {
    render(<HelpDrawer open onClose={vi.fn()} />);

    expect(screen.getByTestId("help-drawer-scroll")).toHaveTextContent(
      "Reset everything deletes everything in this browser and signs you out."
    );
  });
});
