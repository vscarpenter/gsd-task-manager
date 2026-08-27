import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildPayload } from "@/lib/feedback/feedback-payload";
import { submitFeedback } from "@/lib/feedback/submit-feedback";
import { ROADMAP_ITEMS } from "@/lib/feedback/roadmap-items";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const PAYLOAD = buildPayload(
  {
    sentiment: "up",
    category: "idea",
    message: "more keyboard shortcuts please",
    votes: [ROADMAP_ITEMS[0].slug],
  },
  {
    submissionId: "sub_abc123",
    appVersion: "12.3.1",
    submittedAt: "2026-08-27T10:00:00.000Z",
  },
);

function jsonResponse(status: number): Response {
  return new Response(JSON.stringify({}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(200));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitFeedback", () => {
  it("issues exactly one request", async () => {
    await submitFeedback(PAYLOAD);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts to the feedback records endpoint", async () => {
    await submitFeedback(PAYLOAD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/collections/feedback/records");
    expect(init.method).toBe("POST");
  });

  it("sends no authorization header", async () => {
    await submitFeedback(PAYLOAD);

    const [, init] = fetchMock.mock.calls[0];
    const headerNames = Object.keys(init.headers ?? {}).map((name) => name.toLowerCase());
    expect(headerNames).not.toContain("authorization");
    expect(headerNames).toEqual(["content-type"]);
  });

  it("omits credentials so no cookie rides along", async () => {
    await submitFeedback(PAYLOAD);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("omit");
  });

  it("sends the payload verbatim and nothing more", async () => {
    await submitFeedback(PAYLOAD);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual(PAYLOAD);
  });

  it("reports success on 200", async () => {
    await expect(submitFeedback(PAYLOAD)).resolves.toEqual({ ok: true });
  });

  it("reports rate limiting on 429", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429));

    await expect(submitFeedback(PAYLOAD)).resolves.toEqual({
      ok: false,
      reason: "rate-limited",
    });
  });

  it("reports rejection on 400", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400));

    await expect(submitFeedback(PAYLOAD)).resolves.toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("treats a duplicate submission id as success", async () => {
    // PocketBase answers a unique-index collision with 400. The record already
    // landed, so a retry that collides has achieved what the user asked for.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { submission_id: { code: "validation_not_unique" } } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(submitFeedback(PAYLOAD)).resolves.toEqual({ ok: true });
  });

  it("reports a server fault on 500", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500));

    await expect(submitFeedback(PAYLOAD)).resolves.toEqual({
      ok: false,
      reason: "server",
    });
  });

  it("reports offline when the request rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(submitFeedback(PAYLOAD)).resolves.toEqual({
      ok: false,
      reason: "offline",
    });
  });

  it("never rejects, whatever happens", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));

    await expect(submitFeedback(PAYLOAD)).resolves.toHaveProperty("ok", false);
  });
});
