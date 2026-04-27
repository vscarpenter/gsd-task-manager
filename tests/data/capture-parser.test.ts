import { describe, it, expect } from "vitest";
import { parseCapture } from "@/lib/capture-parser";

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
