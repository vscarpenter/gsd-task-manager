import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const LIGHT_PRIMITIVES = {
  ivory: "#F3F3F7",
  paper: "#FDFDFF",
  slate: "#242331",
  oat: "#F7F7FA",
  accent: "#5C4F7D",
  "accent-d": "#4E426B",
  olive: "#4F7B5F",
  rust: "#B95F5A",
  "rust-d": "#873F3C",
  warning: "#A17D37",
  "warning-dark": "#71551F",
  info: "#5C4F7D",
  sky: "#7A7D8E",
  "ink-3": "#89899B",
  "gray-100": "#ECECF2",
  "gray-200": "#E2E1EA",
  "gray-300": "#D9D9E4",
  "gray-500": "#646477",
  "gray-700": "#3F3E50",
} as const;

const QUADRANTS = {
  q1: "#B95F5A",
  q2: "#4D7A72",
  q3: "#A17D37",
  q4: "#7A7D8E",
  "q1-ink": "#873F3C",
  "q2-ink": "#315B54",
  "q3-ink": "#71551F",
  "q4-ink": "#56596B",
  "q1-wash": "#FBF5F4",
  "q2-wash": "#F2F8F6",
  "q3-wash": "#FAF7EF",
  "q4-wash": "#F5F5F8",
  "q1-header": "#F2DEDC",
  "q2-header": "#DDEBE7",
  "q3-header": "#F0E6CF",
  "q4-header": "#E6E6ED",
} as const;

const DARK_PRIMITIVES = {
  ivory: "#14131B",
  paper: "#211F2B",
  slate: "#ECEAF2",
  oat: "#191821",
  accent: "#A99BCB",
  "accent-d": "#BBAFDA",
  olive: "#82B793",
  "olive-d": "#A0C9AB",
  rust: "#D88C86",
  "rust-d": "#E7A7A3",
  warning: "#D0AF68",
  "warning-dark": "#E0C485",
  sky: "#A5A7B8",
  "gray-100": "#292734",
  "gray-200": "#302E3B",
  "gray-300": "#393645",
  "gray-500": "#AAA6B8",
  "gray-700": "#D0CDD9",
} as const;

const DARK_QUADRANTS = {
  q1: "#D88C86",
  q2: "#83B2A8",
  q3: "#D0AF68",
  q4: "#A5A7B8",
  "q1-ink": "#E7A7A3",
  "q2-ink": "#A6CEC6",
  "q3-ink": "#E0C485",
  "q4-ink": "#C3C4D0",
  "q1-wash": "#1C181E",
  "q2-wash": "#171E1D",
  "q3-wash": "#1E1B17",
  "q4-wash": "#1B1B22",
  "q1-header": "#352327",
  "q2-header": "#253632",
  "q3-header": "#352E20",
  "q4-header": "#2C2C37",
} as const;

const RETIRED_COLORS = ["#B23A2E", "#2C6680", "#8A6A22", "#6F685F", "#F4F1E9"];
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

describe("Violet Frost theme contract", () => {
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
    expect(contrast("#8D8C9D", LIGHT_PRIMITIVES.paper)).toBeGreaterThanOrEqual(3);
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
    expect(contrast("#6F6B80", DARK_PRIMITIVES.paper)).toBeGreaterThanOrEqual(3);
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

  it("updates metadata, SVGs, and the linked report without retired Tidewater colors", () => {
    const manifest = JSON.parse(source("public/manifest.json")) as { background_color: string; theme_color: string };
    expect(manifest).toMatchObject({ background_color: "#F3F3F7", theme_color: "#5C4F7D" });
    for (const path of ["public/favicon.svg", "public/icons/icon.svg", "public/og-image.svg", "public/docs/codebase-analysis-report.html"]) {
      const content = source(path);
      expect(content).toContain("#5C4F7D");
      for (const retired of RETIRED_COLORS) expect(content.toUpperCase()).not.toContain(retired);
    }
    const standaloneFallbacks = `${source("app/global-error.tsx")}\n${source("public/docs/codebase-analysis-report.html")}`;
    for (const value of ["#14131B", "#211F2B", "#ECEAF2", "#A99BCB"]) {
      expect(standaloneFallbacks).toContain(value);
    }
    expect(source("app/global-error.tsx")).toContain("--error-control-border: #6F6B80");
    expect(source("app/global-error.tsx")).toContain("border-color: var(--error-control-border)");
  });

  it("updates every shipped raster asset without retired Tidewater colors", async () => {
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
