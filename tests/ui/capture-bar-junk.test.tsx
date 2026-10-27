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

  it("leaves a single-line paste to the browser", () => {
    const onSubmit = vi.fn();
    render(<CaptureBar onSubmit={onSubmit} />);
    paste(screen.getByLabelText("Add a task"), "just one line");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
