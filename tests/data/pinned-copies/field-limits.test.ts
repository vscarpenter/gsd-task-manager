import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";

/**
 * Pins the web copy of the field limits to a fixture the MCP suite also reads
 * (packages/mcp-server/src/__tests__/pinned-copies/field-limits.test.ts). The
 * two copies are kept by hand, so a limit changed in one copy alone must turn
 * one suite red. To change a shared limit, change both copies and the fixture.
 */

interface FieldLimitsFixture {
  shared: Record<string, number>;
  webOnly: Record<string, number>;
  mcpOnly: Record<string, number>;
  knownGaps: Array<{ key: string; presentIn: "web" | "mcp" }>;
}

const fixture: FieldLimitsFixture = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/pinned-copies/field-limits.json"), "utf8")
);

const webLimits: Record<string, number> = SCHEMA_LIMITS;

describe("pinned copy: field limits (web)", () => {
  it.each(Object.entries(fixture.shared))("shared limit %s is %d", (key, value) => {
    expect(webLimits[key]).toBe(value);
  });

  it.each(Object.entries(fixture.webOnly))("web-only limit %s is %d", (key, value) => {
    expect(webLimits[key]).toBe(value);
  });

  it("defines exactly the shared and web-only limits", () => {
    const expectedKeys = [...Object.keys(fixture.shared), ...Object.keys(fixture.webOnly)];
    expect(Object.keys(webLimits).sort()).toEqual(expectedKeys.sort());
  });

  it("lists each known gap under the copy that has the key", () => {
    for (const gap of fixture.knownGaps) {
      const copyOnly = gap.presentIn === "web" ? fixture.webOnly : fixture.mcpOnly;
      expect(copyOnly).toHaveProperty(gap.key);
    }
  });
});
