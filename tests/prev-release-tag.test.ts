import { describe, it, expect } from "vitest";
import { prevReleaseTag } from "../scripts/prev-release-tag.cjs";

const TAGS = ["v9.4.0", "v9.3.2", "v9.3.1", "v9.2.0"];

describe("prevReleaseTag", () => {
  it("returns the immediately previous release", () => {
    expect(prevReleaseTag("9.4.0", TAGS)).toBe("v9.3.2");
  });
  it("accepts a v-prefixed current version", () => {
    expect(prevReleaseTag("v9.4.0", TAGS)).toBe("v9.3.2");
  });
  it("returns null when there is no earlier release", () => {
    expect(prevReleaseTag("9.4.0", ["v9.4.0"])).toBeNull();
    expect(prevReleaseTag("9.4.0", [])).toBeNull();
  });
  it("ignores malformed and pre-release tags", () => {
    expect(prevReleaseTag("9.4.0", ["garbage", "v9.4.0-rc1", "v9.3.2"])).toBe("v9.3.2");
  });
  it("compares numerically, not lexically", () => {
    expect(prevReleaseTag("9.4.5", ["v9.4.4", "v9.4.10", "v9.4.5"])).toBe("v9.4.4");
  });
  it("skips tags >= current and finds the highest below", () => {
    expect(prevReleaseTag("9.4.0", ["v10.0.0", "v9.5.0", "v9.1.0", "v8.9.9"])).toBe("v9.1.0");
  });
  it("returns null for invalid current version or non-array tags", () => {
    expect(prevReleaseTag("not-a-version", TAGS)).toBeNull();
    expect(prevReleaseTag("9.4.0", null as unknown as string[])).toBeNull();
  });
});
