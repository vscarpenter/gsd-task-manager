import { describe, it, expect } from "vitest";
import { parseShareCaptureParams } from "@/lib/share-capture";

function params(record: Record<string, string>): URLSearchParams {
  return new URLSearchParams(record);
}

describe("parseShareCaptureParams", () => {
  it("returns null when action is not 'capture'", () => {
    expect(parseShareCaptureParams(params({ action: "new-task", title: "x" }))).toBeNull();
    expect(parseShareCaptureParams(params({}))).toBeNull();
  });

  it("returns null when neither title nor url is provided", () => {
    expect(parseShareCaptureParams(params({ action: "capture" }))).toBeNull();
    expect(parseShareCaptureParams(params({ action: "capture", title: "  " }))).toBeNull();
  });

  it("places task in the Eliminate quadrant (urgent=false, important=false)", () => {
    const draft = parseShareCaptureParams(
      params({ action: "capture", title: "Read this article" })
    );
    expect(draft).not.toBeNull();
    expect(draft?.urgent).toBe(false);
    expect(draft?.important).toBe(false);
  });

  it("uses the page title verbatim and embeds the URL in the description", () => {
    const draft = parseShareCaptureParams(
      params({
        action: "capture",
        title: "Hacker News",
        url: "https://news.ycombinator.com/",
      })
    );
    expect(draft?.title).toBe("Hacker News");
    expect(draft?.description).toBe("https://news.ycombinator.com/");
  });

  it("truncates titles longer than 80 chars with an ellipsis", () => {
    const long = "A".repeat(120);
    const draft = parseShareCaptureParams(params({ action: "capture", title: long }));
    expect(draft?.title.length).toBe(80);
    expect(draft?.title.endsWith("…")).toBe(true);
  });

  it("falls back to URL hostname when title is missing", () => {
    const draft = parseShareCaptureParams(
      params({ action: "capture", url: "https://example.com/some/path" })
    );
    expect(draft?.title).toBe("example.com");
    expect(draft?.description).toBe("https://example.com/some/path");
  });

  it("drops non-http(s) URLs from the description", () => {
    const draft = parseShareCaptureParams(
      params({ action: "capture", title: "ok", url: "javascript:alert(1)" })
    );
    expect(draft?.description ?? "").toBe("");
  });

  it("parses comma-separated tags, lowercased and de-duplicated", () => {
    const draft = parseShareCaptureParams(
      params({ action: "capture", title: "x", tags: "Readme, todo, README, ,todo" })
    );
    expect(draft?.tags).toEqual(["readme", "todo"]);
  });

  it("truncates each tag to 30 chars and caps the list at 20 entries", () => {
    const big = Array.from({ length: 30 }, (_, i) => `tag${i}`).join(",");
    const longTag = "x".repeat(50);
    const draft = parseShareCaptureParams(
      params({ action: "capture", title: "x", tags: `${longTag},${big}` })
    );
    expect(draft?.tags?.length).toBe(20);
    expect(draft?.tags?.[0].length).toBe(30);
  });
});
