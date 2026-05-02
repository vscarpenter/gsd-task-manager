import { describe, it, expect } from "vitest";
import { parseCapture, extractUrlsFromTitle } from "@/lib/capture-parser";

describe("parseCapture", () => {
  it("returns plain title with no flags when input has no markers", () => {
    expect(parseCapture("buy milk")).toEqual({
      title: "buy milk",
      urgent: false,
      important: false,
      tags: [],
    });
  });

  it("treats !! as urgent + important and strips the marker", () => {
    expect(parseCapture("ship release !! tomorrow")).toEqual({
      title: "ship release tomorrow",
      urgent: true,
      important: true,
      tags: [],
    });
  });

  it("treats single ! at word boundary as urgent only", () => {
    expect(parseCapture("call dentist !")).toEqual({
      title: "call dentist",
      urgent: true,
      important: false,
      tags: [],
    });
  });

  it("treats * at word boundary as important only", () => {
    expect(parseCapture("draft Q3 plan *")).toEqual({
      title: "draft Q3 plan",
      urgent: false,
      important: true,
      tags: [],
    });
  });

  it("does not treat ! inside a word as urgent", () => {
    expect(parseCapture("halt!stop")).toEqual({
      title: "halt!stop",
      urgent: false,
      important: false,
      tags: [],
    });
  });

  it("collects #tags and lowercases them", () => {
    expect(parseCapture("review PR #Work #Code-Review")).toEqual({
      title: "review PR",
      urgent: false,
      important: false,
      tags: ["work", "code-review"],
    });
  });

  it("handles all markers together", () => {
    expect(parseCapture("incident !! #ops #urgent")).toEqual({
      title: "incident",
      urgent: true,
      important: true,
      tags: ["ops", "urgent"],
    });
  });

  it("collapses whitespace after stripping markers", () => {
    expect(parseCapture("foo  !  bar")).toEqual({
      title: "foo bar",
      urgent: true,
      important: false,
      tags: [],
    });
  });

  it("returns empty title when input is whitespace only", () => {
    expect(parseCapture("   ")).toEqual({
      title: "",
      urgent: false,
      important: false,
      tags: [],
    });
  });
});

describe("extractUrlsFromTitle", () => {
  it("returns unchanged title and empty urls when no URL present", () => {
    expect(extractUrlsFromTitle("buy milk")).toEqual({
      cleanTitle: "buy milk",
      urls: [],
    });
  });

  it("extracts a single URL from the end of a title", () => {
    expect(extractUrlsFromTitle("Review this https://example.com")).toEqual({
      cleanTitle: "Review this",
      urls: ["https://example.com/"],
    });
  });

  it("extracts a single URL from the middle of a title", () => {
    expect(extractUrlsFromTitle("Check https://example.com for details")).toEqual({
      cleanTitle: "Check for details",
      urls: ["https://example.com/"],
    });
  });

  it("extracts all URLs when multiple are present", () => {
    const result = extractUrlsFromTitle("Compare https://foo.com and https://bar.com");
    expect(result.cleanTitle).toBe("Compare and");
    expect(result.urls).toEqual(["https://foo.com/", "https://bar.com/"]);
  });

  it("returns 'Review link below' as cleanTitle when title is only a URL", () => {
    expect(extractUrlsFromTitle("https://example.com")).toEqual({
      cleanTitle: "Review link below",
      urls: ["https://example.com/"],
    });
  });

  it("returns 'Review link below' when title is only whitespace + URL", () => {
    expect(extractUrlsFromTitle("  https://example.com  ")).toEqual({
      cleanTitle: "Review link below",
      urls: ["https://example.com/"],
    });
  });

  it("blocks javascript: protocol URLs", () => {
    expect(extractUrlsFromTitle("Do task javascript:alert(1)")).toEqual({
      cleanTitle: "Do task javascript:alert(1)",
      urls: [],
    });
  });

  it("blocks URLs with credentials", () => {
    expect(extractUrlsFromTitle("Visit https://user:pass@evil.com")).toEqual({
      cleanTitle: "Visit https://user:pass@evil.com",
      urls: [],
    });
  });

  it("trims trailing punctuation from URLs before validating", () => {
    const result = extractUrlsFromTitle("See https://example.com/path.");
    expect(result.urls).toEqual(["https://example.com/path"]);
    expect(result.cleanTitle).toBe("See");
  });

  it("collapses extra whitespace in cleanTitle after URL removal", () => {
    const result = extractUrlsFromTitle("foo   https://example.com   bar");
    expect(result.cleanTitle).toBe("foo bar");
    expect(result.urls).toEqual(["https://example.com/"]);
  });

  it("preserves capture markers (! * #tag) alongside URL extraction", () => {
    const result = extractUrlsFromTitle("Review https://example.com ! #work");
    expect(result.cleanTitle).toBe("Review ! #work");
    expect(result.urls).toEqual(["https://example.com/"]);
  });
});
