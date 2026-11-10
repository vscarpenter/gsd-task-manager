import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("loadWhatsNewReleases after a failed load", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/whats-new/whats-new.json");
    vi.resetModules();
  });

  it("tries again on the next call instead of keeping the rejection", async () => {
    let failNextLoad = true;
    vi.resetModules();
    vi.doMock("@/lib/whats-new/whats-new.json", () => {
      // The notes chunk was never cached and the device is offline.
      if (failNextLoad) throw new Error("chunk load failed");
      return { default: content };
    });
    const { loadWhatsNewReleases: load } = await import("@/lib/whats-new/load-releases");

    await expect(load()).rejects.toThrow();
    failNextLoad = false;

    await expect(load()).resolves.toEqual(content.releases);
  });
});
