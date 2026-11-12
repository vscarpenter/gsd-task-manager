# docs/diagrams

## Overview

This directory holds three generator scripts next to the diagrams they produce. Two Python scripts write HTML diagrams. One Node script exports the reminder statechart to PNG files. Two child directories hold the TLA+ models behind the charts.

## Interface

- `generate-detail-diagram.py`: run `python3 docs/diagrams/generate-detail-diagram.py`. It takes no arguments and reads no environment variables.
  - It builds an SVG from the tables `NODES`, `ZONES`, `ARROWS`, `LABELS`, and `LEGEND`.
  - Functions: `text(...)`, `mask_width(label, pad)`, `render()`, and `splice(html, svg)`.
- `generate-reminder-statechart.py`: run `python3 docs/diagrams/generate-reminder-statechart.py`. It takes no arguments and reads no environment variables.
  - It draws two charts, `reminders-before` and `reminders-after`, from its own tables.
  - Helpers include `path_d(points, hops)`, `arrow(...)`, `label(...)`, `node(...)`, `legend(items)`, and `svg(slug, ...)`.
- `export-reminder-statechart.mjs`: run `node docs/diagrams/export-reminder-statechart.mjs`. It takes no arguments, reads no environment variables, and exports nothing. It imports `chromium` from `@playwright/test`.
- Subdirectories:
  - [reminder-model](./reminder-model/README.md): two TLA+ models of task reminders, with `check.sh`.
  - [task-lifecycle-model](./task-lifecycle-model/README.md): a TLA+ model of one task's lifecycle.

## Invariants

- `generate-detail-diagram.py:splice` requires exactly two `<svg>` blocks in `architecture.html`. Otherwise it raises `SystemExit`. It replaces only the second block.
- `generate-detail-diagram.py:render` paints zones, arrows, arrow labels, nodes, then the legend.
- `generate-reminder-statechart.py:svg` renames the marker ids per chart, so the two inline SVGs do not clash.
- `generate-reminder-statechart.py:PAGE` hard-codes its state counts and rule counts as text. The script does not read them from a model run.
- `export-reminder-statechart.mjs:open` takes screenshots only after `networkidle` and `document.fonts.ready`.
- `export-reminder-statechart.mjs` treats the first SVG on the page as "before" and the second as "after".

## Side Effects

- `generate-detail-diagram.py` reads `docs/diagrams/architecture.html` and overwrites it in place.
- `generate-reminder-statechart.py` overwrites `docs/diagrams/reminder-statechart.html` (`OUT.write_text`). The write runs at module top level, so an import also writes the file.
- `export-reminder-statechart.mjs` launches Chromium through Playwright. It falls back to installed Chrome (`channel: 'chrome'`) when the first launch fails.
- `export-reminder-statechart.mjs` overwrites `reminder-statechart-before.png`, `reminder-statechart-after.png`, and `reminder-statechart.png` in this directory.
- `export-reminder-statechart.mjs` loads `reminder-statechart.html` from disk. That page links a Google Fonts stylesheet, so the browser makes a network request.

## Verification

- No automated check found for the three generator scripts.
- The reminder models have their own check: `bash docs/diagrams/reminder-model/check.sh`.
