import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaptureBar } from "@/components/matrix-simplified/capture-bar";

describe("<CaptureBar>", () => {
  it("submits parsed title with urgent+important when '!!' is typed", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "ship release !!{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({
      title: "ship release",
      urgent: true,
      important: true,
      tags: [],
    });
  });

  it("clears input after successful submit", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");
    expect(input.value).toBe("");
  });

  it("does not submit empty input", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<CaptureBar onSubmit={onSubmit} />);
    const form = container.querySelector("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("gives every capture control a coarse-pointer touch target", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Capture a task")).toHaveClass("touch-target");
    expect(screen.getByRole("button", { name: /add/i })).toHaveClass("touch-target");

    await userEvent.type(screen.getByLabelText("Capture a task"), "plan roadmap");
    expect(screen.getByTestId("quadrant-toggle")).toHaveClass("touch-target");
  });

  it("keeps native Tab order instead of hijacking Tab to classify the task", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "task body");

    await userEvent.tab();

    expect(screen.getByTestId("quadrant-toggle")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves a draft when Escape leaves Quick Capture", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task") as HTMLInputElement;
    await userEvent.type(input, "keep this thought{Escape}");

    expect(input).toHaveValue("keep this thought");
    expect(input).not.toHaveFocus();
  });

  it("uses a narrow-screen grid and a 16px mobile input", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);

    expect(screen.getByTestId("capture-bar")).toHaveClass("grid", "sm:flex");
    expect(screen.getByLabelText("Capture a task")).toHaveClass("text-base", "sm:text-body");
  });

  it("global 'n' key focuses the input when no editable field is focused", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    fireEvent.keyDown(window, { key: "n" });
    expect(document.activeElement).toBe(input);
  });

  it("does not move focus behind an open modal from the legacy capture shortcut", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const modalButton = document.createElement("button");
    modal.append(modalButton);
    document.body.append(modal);
    modalButton.focus();

    fireEvent.keyDown(modalButton, { key: "n" });

    expect(document.activeElement).toBe(modalButton);
    expect(input).not.toHaveFocus();
    modal.remove();
  });

  it("Details button appears when text is entered and onMoreOptions is provided", async () => {
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /open full task form/i })).toBeNull();
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "my task");
    expect(screen.getByRole("button", { name: /open full task form/i })).toHaveClass("touch-target");
  });

  it("Details button is not rendered when onMoreOptions is not provided", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "my task");
    expect(screen.queryByRole("button", { name: /open full task form/i })).toBeNull();
  });

  it("Details button calls onMoreOptions with parsed payload and clears the input", async () => {
    const onMoreOptions = vi.fn();
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={onMoreOptions} />);
    const input = screen.getByLabelText("Capture a task") as HTMLInputElement;
    await userEvent.type(input, "ship release ! #launch");
    await userEvent.click(screen.getByRole("button", { name: /open full task form/i }));
    expect(onMoreOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "ship release", urgent: true, tags: ["launch"] })
    );
    expect(input.value).toBe("");
  });

  it("keeps the explicit destination state at contrast-safe opacity", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Capture a task"), "plan roadmap");
    await userEvent.click(screen.getByTestId("quadrant-toggle"));

    expect(screen.getByText("·fixed")).not.toHaveClass("opacity-60");
  });

  it("global Shift+N calls onMoreOptions (empty payload) when capture bar has no text", () => {
    const onMoreOptions = vi.fn();
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={onMoreOptions} />);
    fireEvent.keyDown(window, { key: "N", shiftKey: true });
    expect(onMoreOptions).toHaveBeenCalledWith({ title: "", urgent: false, important: false, tags: [] });
  });

  it("pulses the capture icon on a successful submit (delight in the moment)", async () => {
    const { container } = render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    expect(container.querySelector(".animate-capture-pop")).toBeNull();
    await userEvent.type(input, "buy milk{Enter}");
    expect(container.querySelector(".animate-capture-pop")).not.toBeNull();
  });

  it("does not pulse the capture icon when opening the full form via Details", async () => {
    const { container } = render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "ship it");
    await userEvent.click(screen.getByRole("button", { name: /open full task form/i }));
    expect(container.querySelector(".animate-capture-pop")).toBeNull();
  });
});
