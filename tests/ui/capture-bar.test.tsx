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

  it("Tab cycles destination quadrant override (override to q1 → submits as urgent+important)", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "task body");
    // first Tab while typing → q1 override
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ urgent: true, important: true })
    );
  });

  it("global 'n' key focuses the input when no editable field is focused", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Capture a task");
    fireEvent.keyDown(window, { key: "n" });
    expect(document.activeElement).toBe(input);
  });

  it("Details button appears when text is entered and onMoreOptions is provided", async () => {
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /open full task form/i })).toBeNull();
    const input = screen.getByLabelText("Capture a task");
    await userEvent.type(input, "my task");
    expect(screen.getByRole("button", { name: /open full task form/i })).toBeInTheDocument();
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

  it("global Shift+N calls onMoreOptions (empty payload) when capture bar has no text", () => {
    const onMoreOptions = vi.fn();
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={onMoreOptions} />);
    fireEvent.keyDown(window, { key: "N", shiftKey: true });
    expect(onMoreOptions).toHaveBeenCalledWith({ title: "", urgent: false, important: false, tags: [] });
  });
});
