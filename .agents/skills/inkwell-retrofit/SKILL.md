---
name: inkwell-retrofit
description: Apply the Inkwell design system to an existing page or component without creating a competing styling system. Use for styling retrofits, standalone HTML explainers, docs pages, or Tailwind v4 token alignment.
disable-model-invocation: false
---

# inkwell-retrofit

Use this skill when an existing page, component, or standalone document needs to adopt Inkwell while preserving its content and behavior.

## Good fits

- Re-skin an existing page with Inkwell tokens and primitives.
- Convert a standalone HTML explainer or report to the Inkwell visual system.
- Remove duplicate token declarations or competing CSS shims.
- Align a Tailwind v4 project with Inkwell's token and theme model.

Do not use this skill to redesign the product information architecture or rewrite content. The default move is visual alignment, not content invention.

## First read

Before editing, read:

1. `AGENTS.md` for project-specific styling rules.
2. Existing Inkwell files under `app/css/` and `public/css/`.
3. Any sibling page already using Inkwell, such as a report or explainer.
4. The target page/component end to end so content stays intact.

## Core rules

- Reuse existing Inkwell tokens before adding project-specific tokens.
- Do not hardcode hex colors outside token definitions.
- Prefer semantic tokens such as `--ivory`, `--paper`, `--slate`, `--accent`, `--border`, and `--backdrop`.
- Keep one saturated accent unless the page truly needs data-viz hues.
- Use Inkwell primitives where available: `.card`, `.alert`, `.tbl`, `.tldr`, `.toc`, `.sec-head`, `.eyebrow`, `.badge`, `.chip-dot`.
- Preserve the 1.5px hairline convention unless the project explicitly documents a different value.
- Keep typography roles consistent: serif for major headings and editorial callouts, mono for labels/file refs/code, sans for normal body UI.
- Preserve dark-mode behavior through `data-theme` and tokens, not per-component ad hoc overrides.
- SVG fills and strokes should reference tokens so diagrams theme correctly.

## Retrofit steps

1. Identify the current styling source: global CSS, inline styles, Tailwind utilities, standalone `<style>`, or linked CSS.
2. Remove competing token systems only when Inkwell fully replaces them.
3. Map existing colors, borders, typography, spacing, and callouts to Inkwell tokens and primitives.
4. Keep app-specific extensions small, named, and layered after Inkwell imports.
5. Replace hardcoded rgba/hex values with semantic tokens.
6. Preserve content and IDs unless the task explicitly asks for content edits.
7. Verify light and dark modes.
8. Verify the page renders standalone if it was standalone before.

## Tailwind v4 integration checklist

- [ ] Inkwell imports are reachable through the app CSS pipeline.
- [ ] `@import` statements appear before other rules.
- [ ] `@theme` aliases are defined once.
- [ ] `[data-theme]` dark-mode cascade works.
- [ ] Old v3 config token duplication is removed only after equivalent v4 tokens exist.
- [ ] External consumers still have any needed files under `public/css/`.

## Verification

Run the smallest meaningful set:

- `bun typecheck`
- `bun lint`
- `bun run build`
- targeted tests for touched components, if any
- browser smoke test for light, dark, and responsive behavior

## PR notes

In the PR body, include:

- What visual system changed.
- What content intentionally stayed unchanged.
- Any intentional deviation from default Inkwell guidance.
- Light/dark verification notes.
- A short list of hardcoded style values removed.
