import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../public/manifest.json"), "utf8")) as {
  share_target?: { action: string; method: string; enctype: string; params: Record<string, string> };
};

describe("web app manifest share_target", () => {
  it("receives a share as a POST the service worker answers, so nothing rides a request URL", () => {
    expect(manifest.share_target).toEqual({
      action: "/share-target/",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url" },
    });
  });
});
