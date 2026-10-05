import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as tsCopy from "@/lib/sw-cache-logic";

/**
 * Pins both copies of the service-worker cache rules to one case table:
 * lib/sw-cache-logic.ts and public/sw-cache-logic.js, the copy sw.js actually
 * runs. The source-sync test in tests/data/sw-cache-logic.test.ts compares a
 * dozen inputs that mostly fall through to passthrough, so a branch removed
 * from one copy could pass. Each case here is chosen to change if one branch
 * goes.
 */

type SwCacheLogic = typeof tsCopy;

interface RequestCase {
  name: string;
  request: {
    pathname: string;
    accept: string | null;
    sameOrigin: boolean;
    method: string;
    authorization: boolean;
    cacheMode: string | null;
  };
  expected: string;
}

interface UrlCase<T> {
  url: string;
  expected: T;
}

interface SwCacheRulesFixture {
  classifyRequest: RequestCase[];
  getCacheNames: Array<{
    name: string;
    cacheVersion: string;
    immutableVersion: number;
    expected: Record<string, string>;
  }>;
  shouldDeleteCache: {
    currentCacheNames: ReturnType<SwCacheLogic["getCacheNames"]>;
    cases: Array<{ cacheName: string; expected: boolean }>;
  };
  getSafeLegacyCaptureUrl: Array<UrlCase<string | null>>;
  getSafePageUrl: Array<UrlCase<string | null>>;
  isCapturePayloadUrl: Array<UrlCase<boolean>>;
  getEvictionCandidates: Array<{ keys: string[]; maxEntries: number; expected: string[] }>;
}

const fixture: SwCacheRulesFixture = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/pinned-copies/sw-cache-rules.json"), "utf8")
);

/** Loads the importScripts() copy the same way the source-sync test does. */
function loadJsCopy(): SwCacheLogic {
  const source = readFileSync(join(process.cwd(), "public/sw-cache-logic.js"), "utf8");
  const mod = { exports: {} as Record<string, unknown> };
  const factory = (0, eval)(`(function(module) { ${source} })`) as (m: typeof mod) => void;
  factory(mod);
  return mod.exports as unknown as SwCacheLogic;
}

const copies: Array<[string, SwCacheLogic]> = [
  ["lib/sw-cache-logic.ts", tsCopy],
  ["public/sw-cache-logic.js", loadJsCopy()],
];

describe.each(copies)("pinned copy: service-worker cache rules (%s)", (_path, copy) => {
  it.each(fixture.classifyRequest)("classifyRequest: $name is $expected", ({ request, expected }) => {
    const { pathname, accept, sameOrigin, method, authorization, cacheMode } = request;
    expect(
      copy.classifyRequest(pathname, accept, sameOrigin, method, authorization, cacheMode)
    ).toBe(expected);
  });

  it.each(fixture.getCacheNames)("getCacheNames: $name", ({ cacheVersion, immutableVersion, expected }) => {
    expect(copy.getCacheNames(cacheVersion, immutableVersion)).toEqual(expected);
  });

  it.each(fixture.shouldDeleteCache.cases)("shouldDeleteCache: $cacheName is $expected", ({ cacheName, expected }) => {
    expect(copy.shouldDeleteCache(cacheName, fixture.shouldDeleteCache.currentCacheNames)).toBe(expected);
  });

  it.each(fixture.getSafeLegacyCaptureUrl)("getSafeLegacyCaptureUrl: $url", ({ url, expected }) => {
    expect(copy.getSafeLegacyCaptureUrl(url)).toBe(expected);
  });

  it.each(fixture.getSafePageUrl)("getSafePageUrl: $url", ({ url, expected }) => {
    expect(copy.getSafePageUrl(url)).toBe(expected);
  });

  it.each(fixture.isCapturePayloadUrl)("isCapturePayloadUrl: $url is $expected", ({ url, expected }) => {
    expect(copy.isCapturePayloadUrl(url)).toBe(expected);
  });

  it.each(fixture.getEvictionCandidates)(
    "getEvictionCandidates: $keys.length keys, max $maxEntries",
    ({ keys, maxEntries, expected }) => {
      expect(copy.getEvictionCandidates(keys, maxEntries)).toEqual(expected);
    }
  );
});
