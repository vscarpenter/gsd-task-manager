import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalBlock } from "@/components/about/terminal-block";

const code = '{\n  "mcpServers": {}\n}';

// jsdom ships no navigator.clipboard; installing one is the only way to
// exercise the copy path. fireEvent + advanceTimersByTime (not userEvent)
// is this repo's pattern for fake-timer tests — userEvent's click deadlocks
// under vitest fake timers (see install-pwa-prompt.test.tsx).
function installClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("TerminalBlock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the bar label and the code content", () => {
    render(<TerminalBlock label="Claude Desktop config" code={code} />);

    expect(screen.getByText("Claude Desktop config")).toBeInTheDocument();
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument();
  });

  it("copies the code, confirms, and reverts after the feedback window", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(<TerminalBlock label="Claude Desktop config" code={code} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith(code);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("shows a failure state when the clipboard write is rejected", async () => {
    vi.useFakeTimers();
    installClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<TerminalBlock label="Claude Desktop config" code={code} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await act(async () => {});

    expect(screen.getByRole("button", { name: "Copy failed" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
