# Search

A user can filter the matrix from the search field, or find a task from anywhere with the command palette. Choosing a palette result returns to the matrix and focuses the card.

## Sub-features

- `search-title` filters the matrix to cards matching a title.
- `search-tag` matches a tag.
- `search-no-match` shows no cards and leaves the data alone.
- `search-clear` brings every card back.
- `search-slash-key` focuses the search field without typing the slash.
- `search-palette` finds a task in the palette and focuses its card.
- `search-palette-button` opens the palette from the top bar.
- `search-from-other-page` searches from Settings and lands on the matrix.

## How to get to it (user POV)

- Type in the search field on the matrix, or press `/` to focus it.
- Press `⌘K` or `Ctrl+K`, or choose `Open command palette` in the top bar.
- Press `⌥/` on any page, which opens the palette.

## Driving it with gsd-verify

Preconditions:

- `gsd-verify` means `bash .claude/skills/verify-gsd/scripts/gsd-verify`, run from the repository root.
- `gsd-verify up` printed `Ready`, and `gsd-verify doctor` exits 0.
- A `beforeEach` creates `Buy groceries #errands` and `Finish the report *` through the capture bar.

- **Title match.** Type `groceries`. Run `gsd-verify drive search -g search-title`. Only the `Buy groceries` card remains.
- **Tag match.** Type `errands`. Run `gsd-verify drive search -g search-tag`. The same card remains.
- **No match.** Type `volcano`. Run `gsd-verify drive search -g search-no-match`. No cards show, and both rows are still stored.
- **Clear.** Empty the field. Run `gsd-verify drive search -g search-clear`. Both cards return.
- **Slash key.** Click the page heading and press `/`. Run `gsd-verify drive search -g search-slash-key`. `search-input` has focus and stays empty.
- **Palette result.** Press `⌘K`, type `groceries`, and choose the result. Run `gsd-verify drive search -g search-palette`. The palette closes and the card has focus.
- **Palette button.** Choose `Open command palette`. Run `gsd-verify drive search -g search-palette-button`. The palette's search field has focus.
- **From another page.** Open Settings, press `⌥/`, type `groceries`, and choose the result. Run `gsd-verify drive search -g search-from-other-page`. The matrix loads and shows the card.
- **Proof.** Run `gsd-verify drive search`. The `search-title/` folder in the printed evidence folder holds `one-match.png` and `one-match.aria.txt`, which list only the matching card.

## Gotchas

- Pressing `/` while a text field has focus types a slash, so the journey clicks the heading first.
- `⌥/` opens the palette on every page. It doesn't focus the matrix search field, whatever the help text suggests at a glance.
- A palette result highlights a card. It doesn't open the edit drawer, and the highlight clears on a timer, so assert focus right away.
- Filtering hides cards in the DOM. Assert the card count, then read rows to prove the data didn't change.
- The shortcut uses the physical key code because macOS Option turns `/` into `÷`. In Playwright, press `Alt+Slash`.
