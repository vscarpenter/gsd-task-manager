/**
 * The type ramp DESIGN.md documents, as it must exist in code.
 *
 * The ramp is rem so text follows the browser's font-size setting, as iOS
 * Dynamic Type and Android sp already do, while rendering at the documented px
 * by default. Tailwind's text-sm/xs/base must be exact spellings of Small,
 * Caption, and Body, or the One-Ramp Rule's "spelling" claim is false.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const tokens = readFileSync(join(ROOT, "app/css/inkwell-tokens.css"), "utf8");
const globals = readFileSync(join(ROOT, "app/globals.css"), "utf8");

const ROOT_FONT_SIZE_PX = 16;
const RAMP_PX = { display: 48, h1: 32, h2: 24, h3: 19, body: 16, small: 14, caption: 12, eyebrow: 11 };

function declared(css: string, name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("type ramp", () => {
  it("keeps every step in rem, rendering at its documented px by default", () => {
    for (const [step, px] of Object.entries(RAMP_PX)) {
      const value = declared(tokens, `t-${step}`);
      expect(value, `--t-${step}`).toMatch(/^[\d.]+rem$/);
      expect(parseFloat(value ?? "") * ROOT_FONT_SIZE_PX, `--t-${step}`).toBe(px);
    }
  });

  it.each([
    ["sm", "small"],
    ["xs", "caption"],
    ["base", "body"],
  ])("makes text-%s an exact spelling of the %s step", (tailwind, step) => {
    expect(declared(globals, `text-${tailwind}`)).toBe(`var(--t-${step})`);
    expect(declared(globals, `text-${tailwind}--line-height`)).toBe(declared(globals, `text-${step}--line-height`));
    expect(declared(globals, `text-${tailwind}--font-weight`)).toBe(declared(globals, `text-${step}--font-weight`));
  });

  it("sets every serif heading step at 600, matching the iOS app's semibold", () => {
    for (const step of ["display", "h1", "h2", "h3"]) {
      expect(declared(globals, `text-${step}--font-weight`), step).toBe("600");
    }
  });

  it("sets the eyebrow at the documented 600", () => {
    expect(declared(globals, "text-eyebrow--font-weight")).toBe("600");
  });
});
