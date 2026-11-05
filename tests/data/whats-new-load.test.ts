import { describe, expect, it } from "vitest";
import content from "@/lib/whats-new/whats-new.json";
import { loadWhatsNewReleases } from "@/lib/whats-new/load-releases";

describe("loadWhatsNewReleases", () => {
  it("resolves to every release in the bundled notes", async () => {
    await expect(loadWhatsNewReleases()).resolves.toEqual(content.releases);
  });

  it("loads the notes once and reuses them", () => {
    expect(loadWhatsNewReleases()).toBe(loadWhatsNewReleases());
  });
});
