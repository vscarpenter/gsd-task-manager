import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("module cycle boundaries", () => {
  it("keeps smart-view contracts in a dependency-free type module", () => {
    const filters = readFileSync("lib/filters.ts", "utf8");
    const builtIn = readFileSync("lib/smart-views/built-in.ts", "utf8");

    expect(filters).toContain('from "@/lib/smart-views/types"');
    expect(builtIn).toContain('from "@/lib/smart-views/types"');
    expect(builtIn).not.toContain('from "@/lib/filters"');
  });

  it("keeps analytics tag contracts out of the metrics implementation", () => {
    const metrics = readFileSync("lib/analytics/metrics.ts", "utf8");
    const tags = readFileSync("lib/analytics/tags.ts", "utf8");

    expect(metrics).toContain('from "./types"');
    expect(tags).toContain('from "./types"');
    expect(tags).not.toContain('from "./metrics"');
  });

  it("keeps edit-draft state independent of the drawer component", () => {
    const drawer = readFileSync("components/matrix-simplified/edit-drawer.tsx", "utf8");
    const state = readFileSync("components/matrix-simplified/use-edit-draft-state.ts", "utf8");

    expect(drawer).toContain('from "./edit-draft"');
    expect(state).toContain('from "./edit-draft"');
    expect(state).not.toContain('from "./edit-drawer"');
  });
});
