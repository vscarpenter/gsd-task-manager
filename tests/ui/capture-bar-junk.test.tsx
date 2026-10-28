import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { CaptureBar } from "@/components/matrix-simplified/capture-bar";

const ZERO_WIDTH = "​‌‍﻿";

function paste(input: HTMLElement, text: string): void {
  fireEvent.paste(input, { clipboardData: { getData: () => text } });
}

describe("<CaptureBar> junk input", () => {
  it("treats zero-width characters as empty and does not submit", () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Add a task"), { target: { value: ZERO_WIDTH } });
    fireEvent.submit(screen.getByTestId("capture-bar"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByTestId("quadrant-toggle")).toBeNull();
  });

  it("creates one task per pasted line, each parsed on its own, in order", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    await act(async () => {
      paste(screen.getByLabelText("Add a task"), "Pay rent !!\nBook flights *\r\nRenew passport #admin\n\n");
    });
    expect(onSubmit.mock.calls.map(([p]) => p)).toEqual([
      { title: "Pay rent", urgent: true, important: true, tags: [] },
      { title: "Book flights", urgent: false, important: true, tags: [] },
      { title: "Renew passport", urgent: false, important: false, tags: ["admin"] },
    ]);
  });

  it("refuses more than 20 pasted lines, keeps the field, and says so", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    const lines = Array.from({ length: 21 }, (_, i) => `task ${i}`).join("\n");
    await act(async () => {
      paste(screen.getByLabelText("Add a task"), lines);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Paste up to 20 lines at a time.")).toBeInTheDocument();
  });

  // A long line used to stop the batch: lines before it were added, the rest
  // were dropped, and the field was empty. Now nothing is added and it says why.
  it("adds nothing when a pasted line is over the title limit, and names the line", async () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    await act(async () => {
      paste(screen.getByLabelText("Add a task"), `Short one\n${"x".repeat(100)}\nShort two`);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Line 2 is over 80 characters, so nothing was added.");
  });

  it("says how many lines were added when a save fails partway", async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<CaptureBar onSubmit={onSubmit} />);
    await act(async () => {
      paste(screen.getByLabelText("Add a task"), "One\nTwo\nThree");
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Added 1 of 3 lines. The rest were not added.");
  });

  it("leaves a single-line paste to the browser", () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    paste(screen.getByLabelText("Add a task"), "just one line");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
