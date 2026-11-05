import { describe, expect, it } from "vitest";
import content from "@/lib/whats-new/whats-new.json";
import {
  WHATS_NEW_PLATFORMS,
  parseVersion,
  releasesFor,
  type WhatsNewRelease,
} from "@/lib/whats-new/releases";

/**
 * The release notes ship inside every client, so a malformed entry would break
 * What's New on three platforms at once. These checks are the contract in
 * tasks/spec-whats-new.md section 3.
 */

const releases = content.releases as WhatsNewRelease[];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("whats-new.json content contract", () => {
  it("is schema 1 with at least one release per platform", () => {
    expect(content.schema).toBe(1);
    for (const platform of WHATS_NEW_PLATFORMS) {
      expect(releases.some((r) => r.platform === platform)).toBe(true);
    }
  });

  for (const release of releases) {
    describe(`${release.platform} ${release.version}`, () => {
      it("has a known platform, a valid version, and a calendar date", () => {
        expect(WHATS_NEW_PLATFORMS).toContain(release.platform);
        expect(parseVersion(release.version)).not.toBeNull();
        expect(release.date).toMatch(DATE);
        expect(Number.isNaN(Date.parse(`${release.date}T00:00:00Z`))).toBe(false);
      });

      it("has a headline when notable", () => {
        if (release.notable) {
          expect(typeof release.headline).toBe("string");
          expect(release.headline?.trim()).not.toBe("");
        } else {
          expect(release.headline).toBeNull();
        }
      });

      it("has at least one non-empty item", () => {
        const items = [...release.new, ...release.improved, ...release.fixed];
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) expect(item.trim()).not.toBe("");
      });

      it("uses no em dashes", () => {
        const text = [release.headline ?? "", ...release.new, ...release.improved, ...release.fixed];
        for (const line of text) expect(line).not.toContain("—");
      });
    });
  }

  it("never repeats a platform and version", () => {
    const keys = releases.map((r) => `${r.platform}@${r.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("releasesFor", () => {
  const sample: WhatsNewRelease[] = [
    { platform: "web", version: "1.2.0", date: "2026-01-02", notable: true, headline: "B", new: ["b"], improved: [], fixed: [] },
    { platform: "web", version: "1.10.0", date: "2026-01-03", notable: true, headline: "C", new: ["c"], improved: [], fixed: [] },
    { platform: "apple", version: "9.0.0", date: "2026-01-01", notable: true, headline: "X", new: ["x"], improved: [], fixed: [] },
    { platform: "web", version: "1.0.0", date: "2026-01-01", notable: true, headline: "A", new: ["a"], improved: [], fixed: [] },
  ];

  it("keeps one platform, newest first by numeric version", () => {
    expect(releasesFor(sample, "web", "2.0.0").map((r) => r.version)).toEqual(["1.10.0", "1.2.0", "1.0.0"]);
  });

  it("drops releases newer than the running version", () => {
    expect(releasesFor(sample, "web", "1.2.0").map((r) => r.version)).toEqual(["1.2.0", "1.0.0"]);
  });

  it("keeps every release of the platform when the running version is unknown", () => {
    expect(releasesFor(sample, "web", null)).toHaveLength(3);
    expect(releasesFor(sample, "web", "dev")).toHaveLength(3);
  });
});

describe("parseVersion", () => {
  it.each([
    ["14.6.2", [14, 6, 2]],
    ["0.10.0", [0, 10, 0]],
  ])("reads %s", (input, parts) => {
    expect(parseVersion(input)).toEqual(parts);
  });

  it.each(["14.6", "14.6.2.1", "v14.6.2", "14.06.2", "14.6.2-beta", "", " 14.6.2"])(
    "rejects %j",
    (input) => {
      expect(parseVersion(input)).toBeNull();
    }
  );
});
