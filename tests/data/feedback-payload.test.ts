import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { createMockTask } from "@/tests/fixtures";
import type { PBSyncConfig } from "@/lib/sync/types";
import {
  buildPayload,
  isDraftEmpty,
  emptyDraft,
  MAX_MESSAGE_LENGTH,
  PAYLOAD_FIELDS,
  type FeedbackDraft,
} from "@/lib/feedback/feedback-payload";
import { ROADMAP_ITEMS } from "@/lib/feedback/roadmap-items";

const BUILD_OPTIONS = {
  submissionId: "sub_abc123",
  appVersion: "12.3.1",
  submittedAt: "2026-08-27T10:00:00.000Z",
};

function fullDraft(overrides?: Partial<FeedbackDraft>): FeedbackDraft {
  return {
    sentiment: "up",
    category: "idea",
    message: "The matrix finally made me stop firefighting.",
    votes: [ROADMAP_ITEMS[0].slug, ROADMAP_ITEMS[1].slug],
    ...overrides,
  };
}

beforeEach(async () => {
  const db = getDb();
  await db.tasks.clear();
  await db.syncMetadata.clear();
});

describe("buildPayload", () => {
  it("emits exactly the seven allowed fields and nothing else", () => {
    const payload = buildPayload(fullDraft(), BUILD_OPTIONS);

    // Pinned so that adding a field to the payload without updating the
    // preview and this list becomes a test failure, not a silent leak.
    expect(Object.keys(payload).sort()).toEqual([...PAYLOAD_FIELDS].sort());
  });

  it("carries no task content even when the database is full of tasks", async () => {
    const db = getDb();
    await db.tasks.bulkAdd([
      createMockTask({ id: "t1", title: "Renew passport before Lisbon trip" }),
      createMockTask({ id: "t2", title: "Call oncologist about results", tags: ["health"] }),
    ]);

    const serialized = JSON.stringify(buildPayload(fullDraft(), BUILD_OPTIONS));

    expect(serialized).not.toContain("passport");
    expect(serialized).not.toContain("oncologist");
    expect(serialized).not.toContain("health");
    expect(serialized).not.toContain("t1");
  });

  it("carries no device, account, or token identifier", async () => {
    const db = getDb();
    const syncConfig: PBSyncConfig = {
      key: "sync_config",
      enabled: true,
      userId: "pb_user_9f3a",
      deviceId: "device-uuid-4c2b",
      deviceName: "Vinny's laptop",
      email: null,
      provider: null,
      lastSyncAt: null,
    };
    await db.syncMetadata.add(syncConfig);

    const serialized = JSON.stringify(buildPayload(fullDraft(), BUILD_OPTIONS));

    expect(serialized).not.toContain("device-uuid-4c2b");
    expect(serialized).not.toContain("pb_user_9f3a");
    expect(serialized).not.toContain("Vinny's laptop");
    expect(serialized).not.toMatch(/token|authorization|bearer/i);
  });

  it("drops vote slugs that no longer ship", () => {
    const payload = buildPayload(
      fullDraft({ votes: [ROADMAP_ITEMS[0].slug, "retired-feature", "'; DROP TABLE"] }),
      BUILD_OPTIONS,
    );

    expect(payload.votes).toEqual([ROADMAP_ITEMS[0].slug]);
  });

  it("never repeats a vote slug", () => {
    const slug = ROADMAP_ITEMS[0].slug;
    const payload = buildPayload(fullDraft({ votes: [slug, slug, slug] }), BUILD_OPTIONS);

    expect(payload.votes).toEqual([slug]);
  });

  it("accepts a message of exactly the maximum length", () => {
    const message = "x".repeat(MAX_MESSAGE_LENGTH);
    const payload = buildPayload(fullDraft({ message }), BUILD_OPTIONS);

    expect(payload.message).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it("refuses a message one character over the maximum", () => {
    const message = "x".repeat(MAX_MESSAGE_LENGTH + 1);

    expect(() => buildPayload(fullDraft({ message }), BUILD_OPTIONS)).toThrow();
  });

  it("normalizes an unset sentiment and category to empty strings", () => {
    const payload = buildPayload(
      fullDraft({ sentiment: null, category: null }),
      BUILD_OPTIONS,
    );

    expect(payload.sentiment).toBe("");
    expect(payload.category).toBe("");
  });

  it("trims the message so whitespace alone never ships", () => {
    const payload = buildPayload(fullDraft({ message: "  needs dark mode  " }), BUILD_OPTIONS);

    expect(payload.message).toBe("needs dark mode");
  });

  it("passes through the injected submission id, version, and timestamp", () => {
    const payload = buildPayload(fullDraft(), BUILD_OPTIONS);

    expect(payload.submission_id).toBe("sub_abc123");
    expect(payload.app_version).toBe("12.3.1");
    expect(payload.client_submitted_at).toBe("2026-08-27T10:00:00.000Z");
  });
});

describe("isDraftEmpty", () => {
  it("treats a fresh draft as empty", () => {
    expect(isDraftEmpty(emptyDraft())).toBe(true);
  });

  it("treats a whitespace-only message as empty", () => {
    expect(isDraftEmpty({ ...emptyDraft(), message: "   \n  " })).toBe(true);
  });

  it("is non-empty once any single signal is set", () => {
    expect(isDraftEmpty({ ...emptyDraft(), sentiment: "down" })).toBe(false);
    expect(isDraftEmpty({ ...emptyDraft(), category: "bug" })).toBe(false);
    expect(isDraftEmpty({ ...emptyDraft(), message: "hi" })).toBe(false);
    expect(isDraftEmpty({ ...emptyDraft(), votes: [ROADMAP_ITEMS[0].slug] })).toBe(false);
  });
});

describe("ROADMAP_ITEMS", () => {
  it("has unique slugs", () => {
    const slugs = ROADMAP_ITEMS.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every item a label and a description", () => {
    for (const item of ROADMAP_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});
