import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildPayload, emptyDraft, MAX_MESSAGE_LENGTH } from "@/lib/feedback/feedback-payload";
import {
  FEEDBACK_DRAFT_KEY,
  FEEDBACK_LAST_SENT_KEY,
  readDraft,
  writeDraft,
  clearDraft,
  toggleVote,
  readLastSentAt,
  writeLastSentAt,
  subscribeToFeedback,
  getFeedbackSnapshot,
} from "@/lib/feedback/feedback-store";
import { ROADMAP_ITEMS } from "@/lib/feedback/roadmap-items";

const SLUG = ROADMAP_ITEMS[0].slug;
const OTHER_SLUG = ROADMAP_ITEMS[1].slug;

beforeEach(() => {
  // localStorage.clear() no-ops in jsdom under Bun; remove keys individually.
  localStorage.removeItem(FEEDBACK_DRAFT_KEY);
  localStorage.removeItem(FEEDBACK_LAST_SENT_KEY);
  clearDraft();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toggleVote", () => {
  it("adds a slug that was not voted for", () => {
    expect(toggleVote(emptyDraft(), SLUG).votes).toEqual([SLUG]);
  });

  it("removes a slug that was already voted for", () => {
    const voted = toggleVote(emptyDraft(), SLUG);
    expect(toggleVote(voted, SLUG).votes).toEqual([]);
  });

  it("never stores the same slug twice", () => {
    const draft = { ...emptyDraft(), votes: [SLUG, SLUG] };
    expect(toggleVote(draft, OTHER_SLUG).votes).toEqual([SLUG, OTHER_SLUG]);
  });

  it("does not mutate the draft it was given", () => {
    const draft = emptyDraft();
    toggleVote(draft, SLUG);
    expect(draft.votes).toEqual([]);
  });

  it("ignores a slug this build does not ship", () => {
    expect(toggleVote(emptyDraft(), "retired-feature").votes).toEqual([]);
  });
});

describe("draft persistence", () => {
  it("round-trips a draft", () => {
    const draft = {
      sentiment: "down" as const,
      category: "gripe" as const,
      message: "the archive is hard to find",
      votes: [SLUG],
    };

    writeDraft(draft);

    expect(readDraft()).toEqual(draft);
  });

  it("returns an empty draft when nothing was stored", () => {
    expect(readDraft()).toEqual(emptyDraft());
  });

  it("returns an empty draft when the stored value is corrupt", () => {
    localStorage.setItem(FEEDBACK_DRAFT_KEY, "{not json");

    expect(readDraft()).toEqual(emptyDraft());
  });

  it("discards stored fields that do not belong to a draft", () => {
    localStorage.setItem(
      FEEDBACK_DRAFT_KEY,
      JSON.stringify({ ...emptyDraft(), deviceId: "device-uuid-4c2b" }),
    );

    expect(readDraft()).not.toHaveProperty("deviceId");
  });

  it("drops stored votes for features that no longer ship", () => {
    localStorage.setItem(
      FEEDBACK_DRAFT_KEY,
      JSON.stringify({ ...emptyDraft(), votes: [SLUG, "retired-feature"] }),
    );

    expect(readDraft().votes).toEqual([SLUG]);
  });

  it("clears the stored draft", () => {
    writeDraft({ ...emptyDraft(), message: "hello" });

    clearDraft();

    expect(readDraft()).toEqual(emptyDraft());
    expect(localStorage.getItem(FEEDBACK_DRAFT_KEY)).toBeNull();
  });
});

describe("last sent", () => {
  it("is null before anything has been sent", () => {
    expect(readLastSentAt()).toBeNull();
  });

  it("round-trips a timestamp", () => {
    writeLastSentAt("2026-08-27T10:00:00.000Z");

    expect(readLastSentAt()).toBe("2026-08-27T10:00:00.000Z");
  });
});

describe("when localStorage is unavailable", () => {
  it("keeps the draft in memory rather than throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => writeDraft({ ...emptyDraft(), message: "private window" })).not.toThrow();
    expect(readDraft().message).toBe("private window");
  });

  it("reads an empty draft rather than throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => readDraft()).not.toThrow();
    expect(readDraft()).toEqual(emptyDraft());
  });
});

describe("a stored message longer than the payload allows", () => {
  const OVERSIZED = "x".repeat(MAX_MESSAGE_LENGTH + 500);

  function storeOversizedDraft(): void {
    localStorage.setItem(
      FEEDBACK_DRAFT_KEY,
      JSON.stringify({ ...emptyDraft(), message: OVERSIZED }),
    );
  }

  it("is clamped to the limit rather than restored whole", () => {
    storeOversizedDraft();

    expect(readDraft().message).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it("still builds a payload, so opening the section cannot crash", () => {
    storeOversizedDraft();

    expect(() =>
      buildPayload(readDraft(), {
        submissionId: "submission-id",
        appVersion: "12.4.0",
        submittedAt: "2026-08-27T10:00:00.000Z",
      }),
    ).not.toThrow();
  });
});

describe("when another tab changes the draft", () => {
  function emitStorage(key: string | null): void {
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFeedback(listener);

    emitStorage(FEEDBACK_DRAFT_KEY);

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("serves the other tab's draft on the next read", () => {
    const unsubscribe = subscribeToFeedback(() => {});
    getFeedbackSnapshot();

    localStorage.setItem(
      FEEDBACK_DRAFT_KEY,
      JSON.stringify({ ...emptyDraft(), message: "written in the other tab" }),
    );
    emitStorage(FEEDBACK_DRAFT_KEY);

    expect(getFeedbackSnapshot().draft.message).toBe("written in the other tab");
    unsubscribe();
  });

  it("sees a draft the other tab sent and cleared", () => {
    const unsubscribe = subscribeToFeedback(() => {});
    writeDraft({ ...emptyDraft(), message: "about to be sent elsewhere" });
    getFeedbackSnapshot();

    localStorage.removeItem(FEEDBACK_DRAFT_KEY);
    emitStorage(FEEDBACK_DRAFT_KEY);

    expect(getFeedbackSnapshot().draft).toEqual(emptyDraft());
    unsubscribe();
  });

  it("ignores keys that belong to other features", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFeedback(listener);

    emitStorage("gsd-onboarding-seen");

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops listening once the last subscriber leaves", () => {
    const listener = vi.fn();
    subscribeToFeedback(listener)();

    emitStorage(FEEDBACK_DRAFT_KEY);

    expect(listener).not.toHaveBeenCalled();
  });
});
