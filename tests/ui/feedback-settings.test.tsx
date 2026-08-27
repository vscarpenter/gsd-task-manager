import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FeedbackSettings } from "@/components/settings/feedback-settings";
import {
  FEEDBACK_DRAFT_KEY,
  FEEDBACK_LAST_SENT_KEY,
  clearDraft,
} from "@/lib/feedback/feedback-store";
import { MAX_MESSAGE_LENGTH, PAYLOAD_FIELDS } from "@/lib/feedback/feedback-payload";
import { ROADMAP_ITEMS } from "@/lib/feedback/roadmap-items";

let fetchMock: ReturnType<typeof vi.fn>;

function okResponse() {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  // localStorage.clear() no-ops in jsdom under Bun; remove keys individually.
  localStorage.removeItem(FEEDBACK_DRAFT_KEY);
  localStorage.removeItem(FEEDBACK_LAST_SENT_KEY);
  // The store caches its snapshot at module scope; clearing notifies and drops it.
  clearDraft();
  fetchMock = vi.fn().mockResolvedValue(okResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function voteButton(index = 0) {
  return screen.getByRole("button", { name: new RegExp(ROADMAP_ITEMS[index].label, "i") });
}

function sendButton() {
  return screen.getByRole("button", { name: /send feedback/i });
}

describe("FeedbackSettings", () => {
  it("lists every roadmap candidate", () => {
    render(<FeedbackSettings />);

    for (const item of ROADMAP_ITEMS) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it("makes no network request while drafting", () => {
    render(<FeedbackSettings />);

    fireEvent.click(voteButton());
    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: "hello" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables send until the draft has something in it", () => {
    render(<FeedbackSettings />);

    expect(sendButton()).toBeDisabled();

    fireEvent.click(voteButton());

    expect(sendButton()).toBeEnabled();
  });

  it("exposes vote state to assistive technology", () => {
    render(<FeedbackSettings />);

    expect(voteButton()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(voteButton());

    expect(voteButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles a vote back off", () => {
    render(<FeedbackSettings />);

    fireEvent.click(voteButton());
    fireEvent.click(voteButton());

    expect(voteButton()).toHaveAttribute("aria-pressed", "false");
    expect(sendButton()).toBeDisabled();
  });

  it("sends exactly what the preview showed", async () => {
    render(<FeedbackSettings />);

    fireEvent.click(voteButton());
    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: "the archive is hard to find" },
    });

    const preview = screen.getByTestId("feedback-payload-preview").textContent ?? "";
    fireEvent.click(sendButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual(JSON.parse(preview));
  });

  it("shows only the disclosed fields in the preview", () => {
    render(<FeedbackSettings />);
    fireEvent.click(voteButton());

    const preview = screen.getByTestId("feedback-payload-preview").textContent ?? "";

    expect(Object.keys(JSON.parse(preview)).sort()).toEqual([...PAYLOAD_FIELDS].sort());
  });

  it("keeps the message when sending fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<FeedbackSettings />);

    const textarea = screen.getByLabelText(/anything else/i);
    fireEvent.change(textarea, { target: { value: "please keep this" } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/connect/i));

    expect(textarea).toHaveValue("please keep this");
  });

  it("announces a failure in a live region", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<FeedbackSettings />);

    fireEvent.click(voteButton());
    fireEvent.click(sendButton());

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/offline|connect/i),
    );
  });

  it("clears the draft after a successful send", async () => {
    render(<FeedbackSettings />);

    fireEvent.click(voteButton());
    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: "thanks" },
    });
    fireEvent.click(sendButton());

    await waitFor(() => expect(voteButton()).toHaveAttribute("aria-pressed", "false"));

    expect(screen.getByLabelText(/anything else/i)).toHaveValue("");
    expect(sendButton()).toBeDisabled();
  });

  it("reuses the submission id when a failed send is retried", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<FeedbackSettings />);

    fireEvent.click(voteButton());
    fireEvent.click(sendButton());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/connect/i));

    fireEvent.click(sendButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(second.submission_id).toBe(first.submission_id);
  });

  it("caps the message at the documented maximum", () => {
    render(<FeedbackSettings />);

    expect(screen.getByLabelText(/anything else/i)).toHaveAttribute(
      "maxLength",
      String(MAX_MESSAGE_LENGTH),
    );
  });

  it("restores a draft left behind by an earlier visit", () => {
    localStorage.setItem(
      FEEDBACK_DRAFT_KEY,
      JSON.stringify({
        sentiment: "up",
        category: "idea",
        message: "picking up where I left off",
        votes: [ROADMAP_ITEMS[0].slug],
      }),
    );

    render(<FeedbackSettings />);

    expect(screen.getByLabelText(/anything else/i)).toHaveValue("picking up where I left off");
    expect(voteButton()).toHaveAttribute("aria-pressed", "true");
  });
});
