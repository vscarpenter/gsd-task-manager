import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { buildBookmarkletHref } from "@/lib/bookmarklet";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock("sonner", () => ({ toast: toastMock }));

import { BookmarkletSettings } from "@/components/settings/bookmarklet-settings";

const writeText = vi.fn<(text: string) => Promise<void>>();

function bookmarkletLink(): HTMLElement {
  return screen.getByText("Add to GSD");
}

describe("BookmarkletSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("should_give_the_drag_link_the_real_bookmarklet_for_this_origin", () => {
    render(<BookmarkletSettings />);

    // React swaps a javascript: href prop for a throwing stub, which would
    // install a bookmark that does nothing.
    expect(bookmarkletLink()).toHaveAttribute(
      "href",
      buildBookmarkletHref(window.location.origin, ""),
    );
  });

  it("should_expose_the_drag_link_to_assistive_tech_as_a_link", () => {
    render(<BookmarkletSettings />);

    expect(screen.getByRole("link", { name: "Add to GSD" })).toBeInTheDocument();
  });

  it("should_tell_screen_readers_the_link_is_a_drag_target_with_a_copy_alternative", () => {
    render(<BookmarkletSettings />);

    expect(screen.getByRole("link", { name: "Add to GSD" })).toHaveAccessibleDescription(
      /drag.*bookmarks bar.*Copy code/i,
    );
  });

  it("should_put_default_tags_into_the_link", () => {
    render(<BookmarkletSettings />);

    fireEvent.change(screen.getByRole("textbox", { name: "Default tags" }), {
      target: { value: "reading, inbox" },
    });

    expect(bookmarkletLink()).toHaveAttribute(
      "href",
      buildBookmarkletHref(window.location.origin, "reading, inbox"),
    );
  });

  it("should_explain_dragging_instead_of_navigating_when_the_link_is_clicked", () => {
    render(<BookmarkletSettings />);

    const notPrevented = fireEvent.click(bookmarkletLink());

    expect(notPrevented).toBe(false);
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining("bookmarks bar"));
  });

  it("should_copy_the_same_link_the_drag_target_holds", async () => {
    render(<BookmarkletSettings />);
    fireEvent.change(screen.getByRole("textbox", { name: "Default tags" }), {
      target: { value: "reading" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Bookmarklet copied"));
    expect(writeText).toHaveBeenCalledWith(
      buildBookmarkletHref(window.location.origin, "reading"),
    );
  });

  it("should_report_a_failed_copy", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<BookmarkletSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("should_state_that_nothing_saves_until_the_user_confirms", () => {
    render(<BookmarkletSettings />);

    expect(screen.getByText(/Nothing saves until you choose Create task/)).toBeInTheDocument();
  });
});
