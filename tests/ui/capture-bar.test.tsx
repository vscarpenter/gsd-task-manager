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
});
