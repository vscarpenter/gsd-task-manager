import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// next/font/google downloads its files from Google Fonts while `next build`
// runs. That download failed the Docker publish intermittently and fails every
// build that can't reach Google, so the display serif ships in the repo and
// the build needs no network (TOOL-21).
const LAYOUT = "app/layout.tsx";
const FONT_DIR = "app/fonts/newsreader";
const SOURCE_DIRS = ["app", "components", "lib"];
const GOOGLE_FONT_IMPORT = /from\s+["']next\/font\/google["']/;
const LOCAL_FONT_PATH = /path:\s*"(\.\/[^"]+)"/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("Newsreader display serif", () => {
  it("should_load_no_font_from_google_fonts_at_build_time", () => {
    const importers = SOURCE_DIRS.flatMap(sourceFiles).filter((file) =>
      GOOGLE_FONT_IMPORT.test(readFileSync(file, "utf8"))
    );

    expect(importers).toEqual([]);
  });

  it("should_point_every_local_font_path_at_a_committed_file", () => {
    const paths = [...readFileSync(LAYOUT, "utf8").matchAll(LOCAL_FONT_PATH)].map(
      (match) => match[1]
    );

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((path) => !existsSync(join(dirname(LAYOUT), path)))).toEqual([]);
  });

  // The Open Font License lets the files ship only with the license itself.
  it("should_ship_the_open_font_license_beside_the_font_files", () => {
    const license = readFileSync(join(FONT_DIR, "OFL.txt"), "utf8");

    expect(license).toContain("Copyright 2020 The Newsreader Project Authors");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});
