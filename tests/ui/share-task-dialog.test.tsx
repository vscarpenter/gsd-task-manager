/**
 * Tests for the share-task email flow (issue #399):
 * recipient email is validated and encoded before building the mailto: link.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareTaskDialog } from "@/components/share-task-dialog";
import { createMockTask } from "@/tests/fixtures";

// jsdom has no navigator.share, so the dialog defaults to the Email tab and the
// recipient input is visible without any extra interaction.

describe("ShareTaskDialog email flow", () => {
  let capturedHref: string | null;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturedHref = null;
    // Capture the mailto target without navigating: the handler builds an
    // anchor, clicks it, then removes it from the DOM.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        capturedHref = this.getAttribute("href");
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it("builds an encoded mailto link for a valid recipient and closes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ShareTaskDialog task={createMockTask()} open onOpenChange={onOpenChange} />
    );

    await user.type(screen.getByLabelText(/recipient email/i), "alice@example.com");
    await user.click(screen.getByRole("button", { name: /open email client/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedHref).toMatch(/^mailto:alice%40example\.com\?subject=/);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an inline error and does not open the link for an invalid email", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ShareTaskDialog task={createMockTask()} open onOpenChange={onOpenChange} />
    );

    await user.type(screen.getByLabelText(/recipient email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /open email client/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("preserves the recipient-less link when the email is left blank", async () => {
    const user = userEvent.setup();
    render(<ShareTaskDialog task={createMockTask()} open onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /open email client/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedHref).toMatch(/^mailto:\?subject=/);
  });

  it("clears the error once the user edits the email again", async () => {
    const user = userEvent.setup();
    render(<ShareTaskDialog task={createMockTask()} open onOpenChange={vi.fn()} />);

    const input = screen.getByLabelText(/recipient email/i);
    await user.type(input, "bad");
    await user.click(screen.getByRole("button", { name: /open email client/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(input, "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
