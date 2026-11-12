# About

## Overview

This directory has the sections of the About page: hero, matrix explainer, features grid, privacy, MCP, and footer call to action.
Seven files are presentational. Five take no props; `FooterCta` and `FeatureCard` take display props.
Two files declare `"use client"`: `scroll-reveal.tsx` (a reveal wrapper) and `terminal-block.tsx` (a copyable code panel).

## Interface

- `FeatureCard` (`feature-card.tsx`): renders an icon, title, and description card. Props are `icon: LucideIcon`, `title`, `description`, optional `badge`, and optional `className`.
- `FeaturesSection` (`features-section.tsx`): takes no props. It maps the module-level `features` array (10 items) to `FeatureCard`s in a 12-column `lg` grid.
- `FooterCta` (`footer-cta.tsx`): renders the closing call to action. Prop `version: string` renders as `v{version}`.
- `HeroSection` (`hero-section.tsx`): takes no props. It renders the `h1`, intro copy, three calls to action, and a trust-signal row.
- `MatrixSection` (`matrix-section.tsx`): takes no props. It renders a section with `id="how-it-works"` and four quadrant cards (Q1 to Q4).
- `McpSection` (`mcp-section.tsx`): takes no props. It renders MCP copy, four example queries, an npm link, and a `TerminalBlock` with a Claude Desktop config string.
- `PrivacySection` (`privacy-section.tsx`): takes no props. It renders three paragraphs, a six-item checklist, and a privacy policy link.
- `ScrollReveal` (`scroll-reveal.tsx`): client wrapper `div` with class `scroll-reveal`. Props are `children`, optional `className`, and `delay` in milliseconds (default 0).
- `TerminalBlock` (`terminal-block.tsx`): client code panel with a title bar and a copy button. Props are `label: string` and `code: string`.

## Invariants

- `feature-card.tsx:FeatureCard`: when `badge` is set, an explicit `" "` text node precedes it. The accessible name then keeps title and badge apart.
- `features-section.tsx:features`: a comment states that the first three entries are hero features. Array index drives the layout.
- `features-section.tsx:FeaturesSection`: index `i < 3` or `i >= 7` gets `lg:col-span-4`. Every other index gets `lg:col-span-3`.
- `features-section.tsx:Feature.badge`: a comment states that `badge` marks a capability with no entry point yet. No entry in `features` sets it today.
- `hero-section.tsx:HeroSection`: a comment forbids wrapping hero content in `ScrollReveal`, because that component shows children only after hydration.
- `matrix-section.tsx:quadrants`: a comment requires `text-gray-700` for small text on quadrant tints. `--gray-500` drops near 4:1 on a pigment tint.
- `scroll-reveal.tsx:ScrollReveal`: if `(prefers-reduced-motion: reduce)` matches, the effect adds the visible class at once and creates no observer.
- `scroll-reveal.tsx:ScrollReveal`: if `rect.top < window.innerHeight` on mount, the effect adds the visible class at once and creates no observer.
- `scroll-reveal.tsx:ScrollReveal`: the observer unobserves the element after the first intersection, so the reveal fires once. `delay` applies only on the observer path.
- `terminal-block.tsx:COPY_FEEDBACK_MS`: copy state returns to `"idle"` 2000 ms after each copy attempt. The handler clears the prior timer first.
- `terminal-block.tsx:handleCopy`: a rejected `navigator.clipboard.writeText` sets state `"failed"` (label "Copy failed"). It does not throw.
- `terminal-block.tsx:TerminalBlock`: a comment states that the panel keeps a fixed dark surface in both themes through the `--terminal-*` tokens.

## Side Effects

- `scroll-reveal.tsx:ScrollReveal`: the effect reads `window.matchMedia("(prefers-reduced-motion: reduce)")`, `el.getBoundingClientRect()`, and `window.innerHeight`.
- `scroll-reveal.tsx:ScrollReveal`: creates an `IntersectionObserver` with `{ threshold: 0, rootMargin: "0px 0px 400px 0px" }` and disconnects it on cleanup.
- `scroll-reveal.tsx:ScrollReveal`: mutates the DOM directly. It adds class `scroll-reveal--visible` and sets `el.style.transitionDelay`.
- `terminal-block.tsx:handleCopy`: writes to the clipboard with `navigator.clipboard.writeText(code)`.
- `terminal-block.tsx:handleCopy`: starts a `setTimeout` of `COPY_FEEDBACK_MS` (2000). `clearTimeout` runs on a second copy and on unmount.
- `hero-section.tsx:HeroCtas`: renders a `next/link` to `/`, an anchor to `#how-it-works`, and an external link to `https://apps.apple.com/app/id6776731612`.
- `hero-section.tsx:TrustSignals`: renders an external link to `https://github.com/vscarpenter/gsd-task-manager`.
- `footer-cta.tsx:FooterCta`: renders a `next/link` to `/` and an external link to `https://gsdtaskmanager.com/privacy/`.
- `privacy-section.tsx:PrivacySection`: renders an external link to `https://gsdtaskmanager.com/privacy/`.
- `mcp-section.tsx:McpSection`: renders an external link to `https://www.npmjs.com/package/gsd-mcp-server`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
