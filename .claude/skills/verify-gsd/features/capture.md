# Capture a task

Capture lets a user type one line and get a task in the right quadrant, using `!` for urgent, `*` for important, `!!` for both, and `#tag` for tags. The same draft can open in the full form, and other apps can start one through the share sheet or the bookmarklet.

## Sub-features

- `capture-first-visit` takes a brand-new visitor from the `/about` redirect through the tour to a first task.
- `capture-submit` creates a task with the Add button and keeps it across a reload.
- `capture-enter` creates a task with Enter and stores its tag.
- `capture-parser-quadrants` routes `!` to Delegate and a bare title to Eliminate, and keeps `!important` as a literal word.
- `capture-quadrant-pill` overrides the parsed quadrant with the pill in the capture bar.
- `capture-n-key` focuses the capture bar without typing the letter.
- `capture-shift-n` opens the full form.
- `capture-alt-n-other-page` returns to the matrix from another page with the capture bar focused.
- `capture-details` moves the typed draft into the full form, then creates it.
- `capture-palette` opens the full form from the command palette.
- `capture-share-target` opens a draft from an OS share, through the service worker.
- `capture-bookmarklet` opens a draft from a third-party page.

## How to get to it (user POV)

- Type in the `Add a task` field at the top of the matrix, then press Enter or choose the Add button.
- Press `n` on the matrix, or `⌥N` on any page.
- Press `Shift+N`, or type a draft and choose `Details`, for the full form.
- Press `⌘K` or `Ctrl+K` and choose `Create new task`.
- Share a page to the installed PWA from the OS share sheet.
- Click the `Add to GSD` bookmarklet from Settings → Bookmarklet on any web page.

## Driving it with gsd-verify

Preconditions:

- `gsd-verify` means `bash .claude/skills/verify-gsd/scripts/gsd-verify`, run from the repository root.
- `gsd-verify up` printed `Ready`, and `gsd-verify doctor` exits 0.
- Each test starts with no tasks. No seed is needed.

- **First visit.** Load `/` with a fresh profile, skip the tour, and add a task. Run `gsd-verify drive capture -g capture-first-visit`. The URL becomes `/about`, the `Get the right things done.` dialog closes on Skip, and one row is stored.
- **Add button.** Type `Call the bank !!` and choose Add. Run `gsd-verify drive capture -g capture-submit`. The card appears in `quadrant-q1`, the input clears, and the card and its row survive a reload.
- **Enter key.** Type `Plan the offsite * #team` and press Enter. Run `gsd-verify drive capture -g capture-enter`. The card appears in `quadrant-q2`, and the row has `tags: ["team"]`.
- **Parser routing.** Add `Goes to q3 !`, `Goes to q4`, and `!important stays a word`. Run `gsd-verify drive capture -g capture-parser-quadrants`. The first lands in `quadrant-q3`, and the other two land in `quadrant-q4`.
- **Quadrant pill.** Type a plain title, choose the pill, and press Enter. Run `gsd-verify drive capture -g capture-quadrant-pill`. The stored quadrant isn't the Eliminate default.
- **`n` key.** Press `n` on the matrix. Run `gsd-verify drive capture -g capture-n-key`. `capture-input` has focus and stays empty.
- **`Shift+N`.** Press it on the matrix. Run `gsd-verify drive capture -g capture-shift-n`. `edit-drawer` opens.
- **`⌥N` elsewhere.** Open Settings and press `⌥N`. Run `gsd-verify drive capture -g capture-alt-n-other-page`. The matrix loads with `capture-input` focused.
- **Details.** Type `Book flights !! #travel` and choose `Details`. Run `gsd-verify drive capture -g capture-details`. The drawer shows `Book flights`, no card exists yet, and `Create task` produces a `quadrant-q1` card with the tag stored.
- **Palette.** Press `⌘K` and choose `Create new task`. Run `gsd-verify drive capture -g capture-palette`. `edit-drawer` opens.
- **Share target.** Post a share form to `/share-target/`. Run `gsd-verify drive capture -g capture-share-target`. The drawer opens with the shared title and URL filled in.
- **Bookmarklet.** Click the real `href` from Settings on a mocked third-party page. Run `gsd-verify drive capture -g capture-bookmarklet`. A new tab opens the drawer with the page title and URL filled in, and `bookmarklet-draft.png` shows it.
- **Proof.** Run `gsd-verify drive capture`. The `capture-submit/` folder in the printed evidence folder holds `after-submit.png`, `after-submit.aria.txt`, and `after-reload.tasks.json` with the stored flags.

## Gotchas

- Pressing `n` or `/` while a textbox has focus types the character. Click outside the field first.
- Parser tokens must be space-bounded. `!important` is a literal word, and that task lands in Eliminate.
- The parser strips its tokens, so assert the rendered title (`Call the bank`), not what you typed.
- A share needs a controlling service worker, which a fresh profile only gets after `navigator.serviceWorker.ready` and a reload. Without it, the POST falls through to the app shell and no drawer opens.
- The share journey posts the form the way the OS would. It doesn't exercise a real OS share sheet, and that path stays unverified without a device.
