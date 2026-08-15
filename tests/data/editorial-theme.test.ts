import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const LIGHT_PRIMITIVES = {
  ivory: "#F4F1E9",
  paper: "#FFFFFF",
  slate: "#211E1A",
  oat: "#FBF9F3",
  accent: "#2C6680",
  "accent-d": "#234F63",
  olive: "#3E7D52",
  rust: "#B23A2E",
  "rust-d": "#98301F",
  warning: "#C78E3F",
  "warning-dark": "#8A5A1F",
  info: "#2C6680",
  sky: "#4E7E96",
  "ink-3": "#797368",
  "gray-100": "#ECE7DC",
  "gray-200": "#E3DDD0",
  "gray-300": "#D8D1C1",
  "gray-500": "#6E6760",
  "gray-700": "#3A372F",
} as const;

const QUADRANTS = {
  q1: "#B23A2E",
  q2: "#2C6680",
  q3: "#8A6A22",
  q4: "#6F685F",
  "q1-ink": "#B23A2E",
  "q2-ink": "#2C6680",
  "q3-ink": "#74591C",
  "q4-ink": "#615B54",
  "q1-wash": "#F4EBE5",
  "q2-wash": "#E9EFF1",
  "q3-wash": "#F2EDE1",
  "q4-wash": "#EFEDE7",
  "q1-header": "#F4E4E0",
  "q2-header": "#E1ECF1",
  "q3-header": "#F0E9D8",
  "q4-header": "#ECE9E3",
} as const;

const DARK_PRIMITIVES = {
  ivory: "#17150F",
  paper: "#221E17",
  slate: "#F1ECE2",
  oat: "#1B1812",
  accent: "#6FAACB",
  "accent-d": "#5A93B5",
  olive: "#6FB07F",
  "olive-d": "#9CCBA6",
  rust: "#E0705F",
  "rust-d": "#E8907F",
  warning: "#D9A55F",
  "warning-dark": "#D9A55F",
  sky: "#7FB0CB",
  "ink-3": "#948A79",
  "gray-100": "#1B1812",
  "gray-200": "#2A2620",
  "gray-300": "#322D24",
  "gray-500": "#A79F92",
  "gray-700": "#C8C0B2",
} as const;

const DARK_QUADRANTS = {
  q1: "#E0705F",
  q2: "#6FAACB",
  q3: "#CFB266",
  q4: "#A9A096",
  "q1-ink": "#E0705F",
  "q2-ink": "#6FAACB",
  "q3-ink": "#CFB266",
  "q4-ink": "#A9A096",
  "q1-wash": "#231914",
  "q2-wash": "#171E1E",
  "q3-wash": "#201D12",
  "q4-wash": "#1E1B15",
  "q1-header": "#3A211D",
  "q2-header": "#173039",
  "q3-header": "#322B17",
  "q4-header": "#2A2620",
} as const;

/* The Violet Frost palette (retired 2026-08 when web realigned with the iOS
   app, gsdtaskmanager.com, and the brand kit). Saturated brand hexes only —
   near-neutrals are excluded because raster anti-aliasing can synthesize them. */
const RETIRED_COLORS = ["#5C4F7D", "#B95F5A", "#4D7A72", "#A99BCB", "#D88C86"];
const RAW_SEMANTIC_HUE = /(?:bg|text|border|ring|outline|fill|stroke|shadow)-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|blue|indigo|violet|purple|fuchsia|pink)-\d{2,3}/g;

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function expectVariable(css: string, name: string, value: string): void {
  expect(css).toMatch(new RegExp(`--${name}:\\s*${value.replace("#", "#")}`, "i"));
}

function expectVariableCount(css: string, name: string, value: string, count: number): void {
  const matches = css.match(new RegExp(`--${name}:\\s*${value}`, "gi"));
  expect(matches).toHaveLength(count);
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((part) => channel(Number.parseInt(part, 16)));
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return extname(entry.name) === ".tsx" ? [path] : [];
  });
}

async function pngColors(path: string): Promise<Set<string>> {
  const { data, info } = await sharp(join(ROOT, path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index + 3] === 0) continue;
    colors.add(`#${data[index].toString(16).padStart(2, "0")}${data[index + 1].toString(16).padStart(2, "0")}${data[index + 2].toString(16).padStart(2, "0")}`.toUpperCase());
  }
  return colors;
}

describe("GSD Editorial theme contract", () => {
  it("defines the approved light primitives and quadrant palette", () => {
    const primitives = source("app/css/inkwell-tokens.css");
    const globals = source("app/globals.css");
    for (const [name, value] of Object.entries(LIGHT_PRIMITIVES)) expectVariable(primitives, name, value);
    for (const [name, value] of Object.entries(QUADRANTS)) expectVariable(globals, name, value);
  });

  it("keeps primary, muted, action, and quadrant-title text at WCAG AA contrast", () => {
    expect(contrast(LIGHT_PRIMITIVES.slate, LIGHT_PRIMITIVES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(LIGHT_PRIMITIVES["gray-500"], LIGHT_PRIMITIVES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(LIGHT_PRIMITIVES.accent, LIGHT_PRIMITIVES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#938A7B", LIGHT_PRIMITIVES.paper)).toBeGreaterThanOrEqual(3);
    for (const key of ["q1", "q2", "q3", "q4"] as const) {
      expect(contrast(QUADRANTS[`${key}-ink`], QUADRANTS[`${key}-header`])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps automatic and forced dark cascades identical and contrast-safe", () => {
    const primitives = source("app/css/inkwell-tokens.css");
    const globals = source("app/globals.css");
    for (const [name, value] of Object.entries(DARK_PRIMITIVES)) {
      expectVariableCount(primitives, name, value, 2);
    }
    for (const [name, value] of Object.entries(DARK_QUADRANTS)) {
      expectVariableCount(globals, name, value, 2);
    }
    expect(contrast(DARK_PRIMITIVES.slate, DARK_PRIMITIVES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK_PRIMITIVES["gray-500"], DARK_PRIMITIVES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK_PRIMITIVES.accent, DARK_PRIMITIVES.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#746A5B", DARK_PRIMITIVES.paper)).toBeGreaterThanOrEqual(3);
    for (const key of ["q1", "q2", "q3", "q4"] as const) {
      expect(contrast(DARK_QUADRANTS[`${key}-ink`], DARK_QUADRANTS[`${key}-header`])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses semantic tokens instead of raw Tailwind hue families", () => {
    const offenders = [join(ROOT, "app"), join(ROOT, "components")]
      .flatMap(tsxFiles)
      .filter((path) => !path.endsWith("app/global-error.tsx"))
      .flatMap((path) => (readFileSync(path, "utf8").match(RAW_SEMANTIC_HUE) ?? []).map((match) => `${path.replace(`${ROOT}/`, "")}: ${match}`));
    expect(offenders).toEqual([]);
  });

  it("updates metadata, SVGs, and the linked report without retired Violet Frost colors", () => {
    const manifest = JSON.parse(source("public/manifest.json")) as { background_color: string; theme_color: string };
    expect(manifest).toMatchObject({ background_color: "#F4F1E9", theme_color: "#2C6680" });
    for (const path of ["public/favicon.svg", "public/icons/icon.svg", "public/og-image.svg", "public/docs/codebase-analysis-report.html"]) {
      const content = source(path);
      expect(content).toContain("#2C6680");
      for (const retired of RETIRED_COLORS) expect(content.toUpperCase()).not.toContain(retired);
    }
    const standaloneFallbacks = `${source("app/global-error.tsx")}\n${source("public/docs/codebase-analysis-report.html")}`;
    for (const value of ["#17150F", "#221E17", "#F1ECE2", "#6FAACB"]) {
      expect(standaloneFallbacks).toContain(value);
    }
    expect(source("app/global-error.tsx")).toContain("--error-control-border: #746A5B");
    expect(source("app/global-error.tsx")).toContain("border-color: var(--error-control-border)");
  });

  it("updates every shipped raster asset without retired Violet Frost colors", async () => {
    const paths = [
      "public/icons/favicon-16.png",
      "public/icons/favicon-32.png",
      "public/icons/favicon-48.png",
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/apple-touch-icon.png",
      "public/og-image.png",
      "public/gsd-matrix.png",
    ];
    for (const path of paths) {
      const colors = await pngColors(path);
      for (const retired of RETIRED_COLORS) expect(colors.has(retired)).toBe(false);
    }
  });
});
