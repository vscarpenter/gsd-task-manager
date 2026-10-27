import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { CaptureBar } from "@/components/matrix-simplified/capture-bar";

describe("<CaptureBar>", () => {
  it("submits parsed title with urgent+important when '!!' is typed", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "ship release !!{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({
      title: "ship release",
      urgent: true,
      important: true,
      tags: [],
    });
  });

  // An empty Add looked enabled and did nothing, so it now points at the field.
  it("moves focus to the field when Add is clicked with nothing typed", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(screen.getByLabelText("Add a task")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // The pill remounts when its quadrant changes, which dropped focus to <body>
  // after a click, so the Enter that followed did nothing.
  it("still adds the task on Enter after the pill is clicked", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "Call the dentist");
    await userEvent.click(screen.getByTestId("quadrant-toggle"));
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({ title: "Call the dentist", urgent: true, important: true, tags: [] });
  });

  it("keeps keyboard focus on the pill while cycling with the keyboard", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Add a task"), "Call the dentist");
    screen.getByTestId("quadrant-toggle").focus();
    await userEvent.keyboard(" ");
    expect(screen.getByTestId("quadrant-toggle")).toHaveFocus();
  });

  // Before hydration the form has no submit handler, so Add did a plain GET to
  // "/?" that reloaded the page and lost the task typed on a slow connection.
  it("ships Add disabled in the static markup so a pre-hydration tap can't submit", () => {
    const html = renderToString(<CaptureBar onSubmit={vi.fn()} />);
    expect(html).toMatch(/<button[^>]*data-testid="submit-task"[^>]*disabled=""/);
  });

  // React keeps text typed before hydration, but state starts empty, so the
  // next render wrote "" back over it. On a slow phone that lost a task.
  it("keeps text typed before hydration and can add it", async () => {
    const onSubmit = vi.fn();
    const container = document.createElement("div");
    container.innerHTML = renderToString(<CaptureBar onSubmit={onSubmit} />);
    document.body.appendChild(container);
    const typed = container.querySelector("input") as HTMLInputElement;
    typed.value = "Buy milk";

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <CaptureBar onSubmit={onSubmit} />);
    });
    await act(async () => {
      root?.render(<CaptureBar onSubmit={onSubmit} />);
    });

    expect(typed.value).toBe("Buy milk");
    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Buy milk" }));
    act(() => root?.unmount());
    container.remove();
  });

  it("enables Add once the page has hydrated", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    expect(screen.getByTestId("submit-task")).not.toBeDisabled();
  });

  // The latch opened as soon as the save resolved, but the cleared text only
  // lands on the next render, so a second Enter in between saved it again.
  it("does not save the same text twice when Enter repeats before the field clears", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<CaptureBar onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Add a task"), "Call the dentist");
    const form = screen.getByTestId("capture-bar");

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
      await Promise.resolve();
      fireEvent.submit(form);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("clears input after successful submit", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");
    expect(input.value).toBe("");
  });

  it("keeps the draft when saving fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { container } = render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("buy milk");
    expect(container.querySelector(".animate-capture-pop")).toBeNull();
  });

  it("keeps the draft when saving throws", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("disk full"));
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");

    expect(input).toHaveValue("buy milk");
  });

  it("clears the draft only after an async save resolves", async () => {
    let resolveSave: (value: boolean) => void = () => undefined;
    const onSubmit = vi.fn(
      () => new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");

    expect(input).toHaveValue("buy milk");
    resolveSave(true);
    await screen.findByDisplayValue("");
  });

  it("keeps text typed while the save is still pending", async () => {
    let resolveSave: (value: boolean) => void = () => undefined;
    const onSubmit = vi.fn(
      () => new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "buy milk{Enter}");
    await userEvent.clear(input);
    await userEvent.type(input, "call mom");

    await act(async () => resolveSave(true));

    expect(input).toHaveValue("call mom");
  });

  it("keeps a quadrant chosen while the save is still pending", async () => {
    let resolveSave: (value: boolean) => void = () => undefined;
    const onSubmit = vi.fn(
      () => new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "buy milk{Enter}");
    await userEvent.clear(input);
    await userEvent.type(input, "call mom");
    await userEvent.click(screen.getByTestId("quadrant-toggle"));

    await act(async () => resolveSave(true));

    expect(screen.getByText("· chosen")).toBeInTheDocument();
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

    expect(screen.getByLabelText("Add a task")).toHaveClass("touch-target");
    expect(screen.getByRole("button", { name: /add/i })).toHaveClass("touch-target");

    await userEvent.type(screen.getByLabelText("Add a task"), "plan roadmap");
    expect(screen.getByTestId("quadrant-toggle")).toHaveClass("touch-target");
  });

  it("keeps native Tab order instead of hijacking Tab to classify the task", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "task body");

    await userEvent.tab();

    expect(screen.getByTestId("quadrant-toggle")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves a draft when Escape leaves Quick Capture", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "keep this thought{Escape}");

    expect(input).toHaveValue("keep this thought");
    expect(input).not.toHaveFocus();
  });

  it("uses a narrow-screen grid and a 16px mobile input", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);

    expect(screen.getByTestId("capture-bar")).toHaveClass("grid", "sm:flex");
    expect(screen.getByLabelText("Add a task")).toHaveClass("text-base", "sm:text-body");
  });

  it("global 'n' key focuses the input when no editable field is focused", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Add a task");
    fireEvent.keyDown(window, { key: "n" });
    expect(document.activeElement).toBe(input);
  });

  it("does not move focus behind an open modal from the legacy capture shortcut", () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Add a task");
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
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "my task");
    expect(screen.getByRole("button", { name: /open full task form/i })).toHaveClass("touch-target");
  });

  it("Details button is not rendered when onMoreOptions is not provided", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "my task");
    expect(screen.queryByRole("button", { name: /open full task form/i })).toBeNull();
  });

  it("Details button calls onMoreOptions with parsed payload and clears the input", async () => {
    const onMoreOptions = vi.fn();
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={onMoreOptions} />);
    const input = screen.getByLabelText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "ship release ! #launch");
    await userEvent.click(screen.getByRole("button", { name: /open full task form/i }));
    expect(onMoreOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "ship release", urgent: true, tags: ["launch"] })
    );
    expect(input.value).toBe("");
  });

  it("keeps the explicit destination state at contrast-safe opacity", async () => {
    render(<CaptureBar onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Add a task"), "plan roadmap");
    await userEvent.click(screen.getByTestId("quadrant-toggle"));

    expect(screen.getByText("· chosen")).not.toHaveClass("opacity-60");
  });

  it("global Shift+N calls onMoreOptions (empty payload) when capture bar has no text", () => {
    const onMoreOptions = vi.fn();
    render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={onMoreOptions} />);
    fireEvent.keyDown(window, { key: "N", shiftKey: true });
    expect(onMoreOptions).toHaveBeenCalledWith({ title: "", urgent: false, important: false, tags: [] });
  });

  it("pulses the capture icon on a successful submit (delight in the moment)", async () => {
    const { container } = render(<CaptureBar onSubmit={vi.fn()} />);
    const input = screen.getByLabelText("Add a task");
    expect(container.querySelector(".animate-capture-pop")).toBeNull();
    await userEvent.type(input, "buy milk{Enter}");
    expect(container.querySelector(".animate-capture-pop")).not.toBeNull();
  });

  it("does not pulse the capture icon when opening the full form via Details", async () => {
    const { container } = render(<CaptureBar onSubmit={vi.fn()} onMoreOptions={vi.fn()} />);
    const input = screen.getByLabelText("Add a task");
    await userEvent.type(input, "ship it");
    await userEvent.click(screen.getByRole("button", { name: /open full task form/i }));
    expect(container.querySelector(".animate-capture-pop")).toBeNull();
  });
});
