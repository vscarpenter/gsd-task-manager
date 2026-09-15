/**
 * The Inkwell token contract, pinned.
 *
 * The tokens in `app/css/inkwell-tokens.css` and the quadrant families in
 * `app/globals.css` are byte-identical by hand with `gsd-iosapp/App/Theme/Theme.swift`
 * and the Android spec. Nothing else enforces that. This test snapshots every custom
 * property in the light and both dark blocks so a value can only move on purpose, with
 * the fixture regenerated in the same commit as the paired changes in the other repos.
 *
 * `editorial-theme.test.ts` pins a curated subset and the AA pairings the app relies
 * on; this file pins the whole surface.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  diffTokenContract,
  extractTokenContract,
  type TokenContract,
} from "../utils/inkwell-contract";

const ROOT = resolve(__dirname, "../..");
const FIXTURE = join(ROOT, "tests/fixtures/inkwell-token-contract.json");
const UPDATE_FLAG = "UPDATE_INKWELL_TOKEN_CONTRACT";

const PAIRED_CHANGE_RULE = [
  "Inkwell tokens are byte-identical by hand across gsd-taskmanager/app/globals.css,",
  "gsd-iosapp/App/Theme/Theme.swift with QuadrantStyle.swift, and the gsd-android spec.",
  "A value change is a three-repo paired change on the same branch name.",
  `If this change is deliberate and paired, regenerate the fixture with ${UPDATE_FLAG}=1`,
  "bun run test -- tests/data/inkwell-token-contract and commit it alongside.",
].join(" ");

const QUADRANT_FAMILY = /^q[1-4](?:-|$)/;
const AA_TEXT = 4.5;

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function currentContract(): Record<string, TokenContract> {
  return {
    "app/css/inkwell-tokens.css": extractTokenContract(source("app/css/inkwell-tokens.css")),
    "app/globals.css": extractTokenContract(source("app/globals.css"), QUADRANT_FAMILY),
  };
}

describe("extractTokenContract", () => {
  const css = `
    /* --commented-out: #000000; */
    :root {
      --paper: #FFFFFF; /* card */
      --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05);
      --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --paper: #221E17;
      }
      :root:not([data-theme="light"]) .select { color: red; }
    }
    :root[data-theme="dark"] {
      --paper: #221E17;
    }
    .redesign-scope { --paper: #ABCDEF; }
  `;

  it("captures the light block and both dark cascades, and nothing else", () => {
    expect(extractTokenContract(css)).toEqual({
      light: {
        paper: "#FFFFFF",
        "shadow-card": "0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)",
        "ease-out": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      darkAuto: { paper: "#221E17" },
      darkForced: { paper: "#221E17" },
    });
  });

  it("narrows to a token family when asked", () => {
    const quadrants = `:root { --q1: #B23A2E; --q4-ink: #615B54; --quiet: #000; --accent: #2C6680; }`;
    expect(extractTokenContract(quadrants, QUADRANT_FAMILY).light).toEqual({
      q1: "#B23A2E",
      "q4-ink": "#615B54",
    });
  });
});

describe("diffTokenContract", () => {
  const expected: TokenContract = {
    light: { paper: "#FFFFFF", rust: "#B23A2E" },
    darkAuto: { paper: "#221E17" },
    darkForced: { paper: "#221E17" },
  };

  it("reports nothing when the contracts match", () => {
    expect(diffTokenContract(expected, structuredClone(expected))).toEqual([]);
  });

  it("names every changed, added, and removed token with its block", () => {
    const actual: TokenContract = {
      light: { paper: "#FFFFFE", olive: "#3E7D52" },
      darkAuto: { paper: "#221E17" },
      darkForced: { paper: "#221E17" },
    };
    expect(diffTokenContract(expected, actual)).toEqual([
      "light --olive: added (#3E7D52)",
      "light --paper: #FFFFFF -> #FFFFFE",
      "light --rust: removed (was #B23A2E)",
    ]);
  });
});

describe("Inkwell token contract", () => {
  it("matches the committed fixture", () => {
    const actual = currentContract();

    if (process.env[UPDATE_FLAG]) {
      writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`);
    }
    expect(existsSync(FIXTURE), `Missing ${FIXTURE}. ${PAIRED_CHANGE_RULE}`).toBe(true);

    const expected = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, TokenContract>;
    const drift = Object.entries(actual).flatMap(([file, contract]) =>
      diffTokenContract(expected[file] ?? { light: {}, darkAuto: {}, darkForced: {} }, contract)
        .map((line) => `${file}: ${line}`)
    );
    expect(drift, PAIRED_CHANGE_RULE).toEqual([]);
  });

  it("pins the quadrant families in both dark cascades identically", () => {
    const globals = currentContract()["app/globals.css"];
    expect(globals.darkAuto).toEqual(globals.darkForced);
    expect(Object.keys(globals.light).sort()).toEqual(Object.keys(globals.darkAuto).sort());
  });

  it("keeps paper ink readable on every swipe-action ground", () => {
    const tokens = currentContract()["app/css/inkwell-tokens.css"];
    const quadrants = currentContract()["app/globals.css"];
    const grounds = [
      ["olive", tokens],
      ["rust", tokens],
      ["q4", quadrants],
    ] as const;
    for (const block of ["light", "darkAuto", "darkForced"] as const) {
      for (const [name, contract] of grounds) {
        const ratio = contrastRatio(tokens[block].paper, contract[block][name]);
        expect(ratio, `${block} --paper on --${name}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});
