# Writing — depth

(Core carries the MUSTs: route through `write`/`edit` never native, persist incrementally, pass a `summary`. This file carries the supporting detail.)

**Pass a `summary` on every content write (SHOULD).** `write`, `edit`, and `move` each take a one-line `summary` (≤80 chars) describing the user-facing outcome of the change — "Add gear list and permit info", not "edited trip doc". It renders as a bullet under your name in the document timeline and is the only human-readable change-note persisted to the shadow-repo history; omit it and the timeline shows *that* you wrote but not *what changed*. Write it from the reader's perspective, keep it specific, and avoid secrets or PII (it lands in git history). Each entry in the batch `documents:` form carries its own `summary`.

**Reach for visual structure where it aids comprehension.** Default to the right OK primitive over flat prose: a Callout (`> [!NOTE]`) for a key caveat, a ` ```mermaid ` diagram for a process or relationship, a table for options or comparisons, an `html preview` chart for numbers. **Call the `palette` MCP tool as you draft** (and `palette({ components })` for a canonical's JSX schema) — it returns copy-ready markdown-native forms, themed `html preview` embed starters, and the theme tokens, so the visual lands themed and in the content graph instead of hand-rolled. Don't decorate — use a visual only when it carries the point better than prose would. Full catalog: see `references/components-and-visuals.md`.

For the write-response advisory warnings (`content-divergence`, `disk-edit-reconciled`, `mermaid-parse-error`), MDX authoring, and delete/move mechanics, see `references/doc-editing.md`.
