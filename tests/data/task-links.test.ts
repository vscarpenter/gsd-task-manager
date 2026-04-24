import { describe, expect, it } from "vitest";
import { getDescriptionSegments, sanitizeHttpUrl } from "@/lib/task-links";

describe("task link sanitization", () => {
  it("allows http and https URLs", () => {
    expect(sanitizeHttpUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
    expect(sanitizeHttpUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("blocks scriptable and non-http protocols", () => {
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(sanitizeHttpUrl("vbscript:msgbox(1)")).toBeNull();
    expect(sanitizeHttpUrl("ftp://example.com/file.txt")).toBeNull();
  });

  it("blocks whitespace, control characters, credentialed, and malformed URLs", () => {
    expect(sanitizeHttpUrl("https://exa mple.com")).toBeNull();
    expect(sanitizeHttpUrl("https://example.com/\nnext")).toBeNull();
    expect(sanitizeHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(sanitizeHttpUrl("https://")).toBeNull();
  });

  it("linkifies only valid explicit http and https URLs", () => {
    const segments = getDescriptionSegments(
      "Read https://example.com/docs, not javascript:alert(1) or data:text/html,<svg>."
    );

    expect(segments).toEqual([
      { type: "text", text: "Read " },
      { type: "link", text: "https://example.com/docs", href: "https://example.com/docs" },
      { type: "text", text: ", not javascript:alert(1) or data:text/html,<svg>." },
    ]);
  });

  it("leaves descriptions without valid links as plain text", () => {
    expect(getDescriptionSegments("<img src=x onerror=alert(1)> javascript:alert(1)")).toEqual([
      { type: "text", text: "<img src=x onerror=alert(1)> javascript:alert(1)" },
    ]);
  });
});
