# Inkwell

A reusable design system for product UI, dashboards, and technical interfaces. Drop-in CSS tokens, ten core components, light + dark mode out of the box.

**Inkwell** ships with the **Indigo & Cloud** palette — cool stone background, deep indigo accent, serif headlines for gravitas, monospace for technical metadata, hairline 1.5px borders. Reads as Linear/Stripe/Notion-adjacent without being a clone of any of them.

The system separates *structure* (borders, type scale, spacing, motion, components) from *brand* (colors). Three alternate palettes — warm clay, forest sage, literary burgundy — are preserved in `variants/` for reference. The structural layer is identical across all four; only the brand-layer tokens differ.

> **Why "Inkwell"?** Print metaphor for editorial discipline; an inkwell is also a dark vessel, which signals dark mode is a first-class concern. Color-agnostic — the name still fits if you ever swap palettes.

---

## 1. Foundations

### 1.1 Color

A small palette (12 hues) with one accent doing all the work. Neutrals are *cool putty* — slightly warm but biased away from cream. Both light and dark modes are defined; dark mode applies automatically via `prefers-color-scheme: dark` unless overridden by `data-theme="light"`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ivory` | `#F4F4F0` | `#0F1018` | Page background |
| `--paper` | `#FFFFFF` | `#181A24` | Cards, panels, inputs |
| `--slate` | `#13141B` | `#E8E8EE` | Primary text |
| `--oat` | `#DDDCDF` | `#2B2D38` | Tertiary surface, hover thumbnails |
| `--accent` | `#3B4A8C` | `#7A8AD1` | **Primary accent** — links, focus, active state |
| `--accent-d` | `#2A3768` | `#6273C0` | Hover/pressed accent |
| `--accent-tint` | `rgba(59,74,140,0.14)` | `rgba(122,138,209,0.18)` | Badge background |
| `--accent-focus-ring` | `rgba(59,74,140,0.18)` | `rgba(122,138,209,0.28)` | Input focus halo |
| `--accent-strong-border` | `rgba(59,74,140,0.5)` | `rgba(122,138,209,0.6)` | Tinted chip border |
| `--olive` | `#788C5D` | `#9CB07A` | Success, additions |
| `--rust` | `#B04A3F` | `#D27468` | Danger, deletions |
| `--warning` | `#C78E3F` | `#D9A55F` | Amber warning |
| `--info` / `--sky` | `#5C7CA3` / `#6A8CAF` | `#7C9FD2` / `#85A6CB` | Informational accents |
| `--gray-100` | `#EDEDEA` | `#1E1F29` | Subtle row stripe, code-chip bg |
| `--gray-200` | `#E1E1DE` | `#262732` | Divider on white |
| `--gray-300` | `#CFCFCC` | `#34363F` | **Default border** — the 1.5px hairline |
| `--gray-500` | `#85858A` | `#9A9AA0` | Muted text, captions |
| `--gray-700` | `#3A3B41` | `#C0C0C7` | Secondary body text |

**Why the dark accent is *lifted***: `#3B4A8C` against a near-black background reads as a hole punched in the page rather than an accent. The dark variant `#7A8AD1` (periwinkle) restores the sense of a "highlighted element" by retaining hue while gaining luminance. This pattern — saturated in light, lifted in dark — applies to all colored tokens.

### 1.2 Typography

Three font families, each with a clear job. No custom fonts — platform stacks for instant load and zero FOUT.

```css
--serif: ui-serif, Georgia, "Times New Roman", Times, serif;
--sans:  system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--mono:  ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
```

| Family | Job |
|---|---|
| **Serif** | All headings, stat numbers, italic-emphasized phrases. Editorial gravitas. |
| **Sans** (system-ui) | Body text, buttons, labels. The default. |
| **Mono** | Eyebrows, file names, hex codes, code chips, table headers, table-numeric cells. Anything that signals "technical metadata." |

Type scale (use the `.t-*` classes shipped in `tokens.css`):

| Class | Family | Size | Line-height | Weight | Tracking |
|---|---|---|---|---|---|
| `.t-display` | serif | 48px | 1.1 | 500 | -0.02em |
| `.t-h1` | serif | 32px | 1.2 | 500 | -0.01em |
| `.t-h2` | serif | 24px | 1.3 | 500 | — |
| `.t-h3` | serif | 19px | 1.22 | 500 | -0.008em |
| `.t-body` | sans | 16px | 1.55 | 430 | — |
| `.t-small` | sans | 14px | 1.5 | 430 | — |
| `.t-caption` | sans | 12px | 1.4 | 500 | — |
| `.eyebrow` | mono | 11–12px | 1 | 500 | 0.12em, UPPERCASE |

Heading hero pattern uses `clamp()` for fluid scaling:
```css
font-size: clamp(38px, 5.4vw, 62px);
```

### 1.3 Spacing

8px-based scale with a 4px micro step:

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`

Tokens: `--sp-1` through `--sp-8`. Section gaps tend to be 48–72px; card padding 18–24px; inline gaps 8–16px.

### 1.4 Radius

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 4px | Code chips, tight tags |
| `--r-sm` | 8px | Inputs, table rows, small buttons |
| `--r-md` | 12px | Panels, stat cards |
| `--r-lg` | 14px | Feature/link cards |
| `--r-xl` | 20px | Large containers |
| `--r-pill` | 999px | Badges, pills, TOC chips |

### 1.5 Borders — the signature

Every panel uses **1.5px** borders, not 1px. This is the system's most distinctive technical choice: 1px reads as "wireframe," 2px reads as "playful," 1.5px reads as "hairline." Always pair with `--gray-300`.

```css
--border: 1.5px solid var(--gray-300);
```

Hairline dividers inside panels drop to 1px (`--gray-100`) so the outer frame stays dominant.

### 1.6 Shadows

Warm low-spread in light mode (slight orange undertone via `rgba(20,20,19, …)`); deep-pure-black in dark mode (warm shadows would vanish on dark surfaces).

| Token | Light | Dark |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(20,20,19,0.06)` | `0 1px 2px rgba(0,0,0,0.45)` |
| `--shadow-md` | `0 4px 14px rgba(20,20,19,0.08)` | `0 4px 14px rgba(0,0,0,0.50)` |
| `--shadow-lg` | `0 12px 28px rgba(20,20,19,0.12)` | `0 12px 28px rgba(0,0,0,0.55)` |
| `--shadow-card-hover` | `0 10px 30px rgba(20,20,19,0.10)` | `0 10px 30px rgba(0,0,0,0.50)` |

### 1.7 Motion

| Token | Value | Use |
|---|---|---|
| `--t-fast` | 120ms | Color/border state changes |
| `--t-base` | 150ms | Card hover, transform |
| `--t-slow` | 300ms | Larger reveals |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default |
| `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Slight overshoot |

The signature card-hover gesture is a 3px translateY lift + shadow swap + border-color shift to slate. `prefers-reduced-motion` is respected automatically.

### 1.8 Layout

| Token | Width | Use |
|---|---|---|
| `--content-narrow` | 820px | Single-column reading |
| `--content-default` | 920px | Mixed prose + components |
| `--content-wide` | 1120px | Index/grid pages |

Wrappers ship as classes: `.wrap`, `.wrap-narrow`, `.wrap-wide`. Page padding is `0 24px`.

---

## 2. Dark mode

Pattern B is built in: dark mode applies automatically, with an opt-out for users who want to override.

```html
<!-- Auto: respects OS preference -->
<html>

<!-- Force light (overrides OS dark mode) -->
<html data-theme="light">

<!-- Force dark (overrides OS light mode) -->
<html data-theme="dark">
```

Cascade:

1. `prefers-color-scheme: dark` activates dark tokens — UNLESS `[data-theme="light"]` is set
2. `[data-theme="dark"]` always activates dark tokens
3. `[data-theme="light"]` always keeps light tokens

To wire a manual toggle, set/remove the attribute on `<html>` from JS and persist to `localStorage`. The `preview.html` and `index.html` files include a working three-state toggle (Auto / Light / Dark) you can lift directly.

`color-scheme: light dark` is declared on `:root`, so native UI (scrollbars, form controls) follows the active scheme automatically.

---

## 3. Components

`tokens.css` ships ten reusable component classes. Open `preview.html` for a live tour of all of them in both light and dark mode.

| Class | Purpose |
|---|---|
| `.btn` (+ `-primary` / `-secondary` / `-ghost` / `-danger`) | Buttons across all intents |
| `.input` | Text inputs with accent focus halo |
| `.checkbox` | Custom checkbox with accent fill |
| `.badge` (+ neutral / accent / success / warning / danger) | Pill-shaped status labels |
| `.card` (+ `.is-link`) | Generic card; the `.is-link` variant adds the 3px hover-lift gesture |
| `.stat-card` (+ `.warn`) | Big-number metric tile |
| `.tbl` | Table with mono header labels and hairline row dividers |
| `.tldr` | Inverted callout — dark in light mode, light in dark mode |
| `.pill` (+ sev / resolved / neutral) | Severity / status pill |
| `.timeline` (+ `.tl-entry`) | Vertical event timeline |
| `.chip-dot` (+ safe / medium / attention) | Mono label with colored status dot |
| `.avatar` | 36px monogram circle |
| `.eyebrow` | Uppercase mono lead-in label with accent rule |
| `.sec-head` | Numbered section header (mono index + serif title + count pill) |
| `.toc` | Pill-shaped link list with optional mono numerals |

---

## 4. Anti-patterns

These will break the look — avoid them:

- **Pure white page background.** Use `--ivory`. White on white kills depth.
- **Pure black text.** Use `--slate` (`#13141B`). Pure black is too cold for the system's tone.
- **Warm grays.** The neutrals here are *cool putty*. Mixing in warm beige grays (e.g., `#F0EEE6`) makes the cool indigo accent feel orphaned.
- **Multiple accent colors.** One indigo, period. If you need a second accent for data viz, use olive or sky — not a second saturated hue.
- **1px or 2px borders.** Stick to 1.5px for the signature outer frames.
- **Sans-serif headings.** Serifs do the editorial work; replacing them collapses the personality and makes everything read as "generic SaaS."
- **Heavy drop shadows.** Stay under 12% opacity in light mode; under 55% in dark. Big floaty shadows feel "Material Design"; this system is letterpress-quiet.
- **Emoji icons.** Use inline SVG strokes.
- **Gradients on surfaces.** Surfaces are flat.
- **Saturated semantic colors.** Olive/rust/warning are deliberately desaturated to sit on the cool palette without screaming.
- **Hardcoded hex values in component CSS.** Always reference tokens. Adding a new variant later (or theming for a customer) is trivial when everything is tokenized — painful when literals are scattered.

---

## 5. Quick start

Drop `inkwell.css` and `tokens.css` into your project and link `inkwell.css` from `<head>`. The body inherits ivory background, slate text, sans body, and the active light/dark scheme automatically.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="inkwell.css">
  <title>My new app</title>
</head>
<body>
  <div class="wrap">
    <div class="eyebrow">Section label</div>
    <h1 class="t-h1">A serif headline with <em class="accent">italic accent</em></h1>
    <p class="t-body">Body copy at 16/1.55, sans, weight 430.</p>

    <button class="btn btn-primary">Primary action</button>
    <button class="btn btn-secondary">Cancel</button>
  </div>
</body>
</html>
```

For a fuller starting point, copy `index.html` — it includes the navbar, layout shell, sample components, and a working light/dark/auto toggle. For a comprehensive component reference, open `preview.html`.

---

## 6. Project structure

```
design-system/
├── inkwell.css             ← link this in <head> (brand-named alias)
├── tokens.css              ← the actual system tokens; inkwell.css re-exports it
├── DESIGN_SYSTEM.md        ← this file
├── index.html              ← starter template (copy as seed of a new project)
├── preview.html            ← comprehensive component showcase
└── variants/               ← archived alternative palettes (warm clay / sage / burgundy)
    ├── tokens-clay.css     ← original warm-editorial palette
    ├── tokens-sage.css     ← forest / knowledge-product palette
    ├── tokens-burgundy.css ← literary / magazine palette
    ├── tokens-indigo.css   ← variant-format version of this palette
    ├── preview-clay.html
    ├── preview-sage.html
    ├── preview-burgundy.html
    ├── preview-indigo.html
    └── compare.html        ← side-by-side comparison of all four
```

If you ever want to swap palettes, the variant files in `variants/` show the pattern: a ~30-line CSS file overriding only the brand-layer tokens. The structural layer (everything below the `:root` block in `tokens.css`) doesn't need to change.
