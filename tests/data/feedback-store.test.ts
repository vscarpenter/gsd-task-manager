import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { emptyDraft } from "@/lib/feedback/feedback-payload";
import {
  FEEDBACK_DRAFT_KEY,
  FEEDBACK_LAST_SENT_KEY,
  readDraft,
  writeDraft,
  clearDraft,
  toggleVote,
  readLastSentAt,
  writeLastSentAt,
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
