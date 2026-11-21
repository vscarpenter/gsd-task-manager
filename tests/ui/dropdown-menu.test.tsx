import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("DropdownMenuContent", () => {
  // Radix returns focus with a plain focus(), and the scroll margins under the
  // topbar made that jump the page beneath a trigger in plain view.
  it("returns focus to the trigger without scrolling the page", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>More actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    await screen.findByRole("menuitem", { name: "Duplicate" });
    const focus = vi.spyOn(trigger, "focus");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("leaves focus alone when the caller handles the close itself", async () => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>More actions</DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={onCloseAutoFocus}>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    await screen.findByRole("menuitem", { name: "Duplicate" });
    const focus = vi.spyOn(trigger, "focus");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalled());
    expect(focus).not.toHaveBeenCalled();
  });
});
