# Preview — full multi-host contract

## Contents
- **Step 0 — determine your ONE focus surface before opening anything (the load-bearing check)**
- Re-navigation and end-of-turn discipline
- `previewUrl` is a route, not a URL
- The three first-class apps (Claude Code Desktop, Cursor, Codex desktop)
- Any-CLI track — Claude Code / Codex / Cursor CLI / OpenCode / Pi, no browser → `ok open`
- Four attach signals
- `previewUrl: null` semantics, server lifecycle, read-only mirror, no-screenshots

---

The user watches your edits land in a live browser preview. Open it once at session start, then keep working. Re-navigate only when the user asks to open a different doc, or to land them on a finished deliverable (see below) — not to re-check your own edits.

**End a turn on the deliverable, not your scratch space.** Keep the preview steady *during* a multi-doc task — don't yank it around to re-check your own edits. But when a turn created or substantially changed user-facing docs, navigate the preview to the primary deliverable before you hand back: the hub / overview / index page when you created several docs, or the changed doc when you changed one. Don't step the user through every supporting source card — the user is watching, so leave them on the result.

**`previewUrl` is a route, not a URL to open.** Every read response (per-doc, on `exec` / `search` / `links` rows) and every write response carries a `previewUrl` — a route fragment like `/#/specs/foo/SPEC`, with **no scheme, host, or port**. It identifies *which doc* to preview, not a URL to hand a browser by itself. Never construct or guess preview URLs.

### Step 0 — figure out your ONE focus surface BEFORE you open anything

Your host doesn't change mid-session, so determine this **once**, the first time you're asked to open/show/preview a doc, and use that one surface for the rest of the session. Run the checks **top-to-bottom and stop at the first match** — earlier rungs win:

1. **Is `OK_DESKTOP_TERMINAL` set in your environment?** You're a shell agent — actually check it (`echo "$OK_DESKTOP_TERMINAL"`, or read your env), don't assume. **Set → you're inside the OK Desktop app's own terminal.** Open a doc or folder with `ok open <name>` (auto-detected; `--skill <name>` for a skill) — it switches THIS window to the target. **Never resolve a preview URL here.** (This rung is the one agents miss most — check the env first, before anything else.)
2. **Do you have `preview_*` tools** (`preview_start` / `preview_eval`)? → **Claude Code Desktop** → drive its pane (rung details below).
3. **Do you have any URL-navigation / in-app browser tool** (Cursor `Navigate`, Codex `@Browser`, or `browser` / `open_url` / `view_url` / …)? → **Cursor / Codex desktop** → `preview_url` once, then navigate that browser to the `url`.
4. **None of the above** → you're a **plain CLI** (Claude Code CLI, Codex CLI, Cursor CLI, OpenCode, Pi, any shell agent) → `ok open <name>` for a doc or folder (auto-detected; `--skill <name>` for a skill); deep-links a separate OK Desktop window, system browser only if no desktop.

Decide once; then every "open / show / preview this doc" this session uses that surface's mechanism. **The `previewUrl` field in tool responses is a route id, not your open mechanism** — seeing it is not a reason to hand it to a browser. The rest of this section is the per-surface "how" for whichever rung you landed on.

**OK ships first-class preview support for three apps — Claude Code Desktop, Cursor, and the Codex desktop app — plus any CLI (Claude Code CLI, Codex CLI, Cursor CLI, OpenCode, Pi, …) on a separate `ok open` track (below). Make the preview seamless in each.** Match on the tool you actually have (capability, not host name): if a tool can navigate to a URL, it counts as an in-app browser; if nothing can, you're a CLI → `ok open`. The three apps map to:

- **Claude Code Desktop — you have `preview_*` tools** (e.g. `preview_start` + `preview_eval`) → **First open of the session:** to land directly on a doc, arm it first with `preview_url({ armPaneTarget: true, document })` (or `folder`), then `preview_start("open-knowledge-ui")` — `ok ui` redirects the base-open straight to the armed route, so the pane opens on the doc, not root. Plain `preview_start` (no arm) opens at root. **Moving between docs once the pane is open: do it in one `preview_eval` step — set `window.location.hash` to the target's route fragment from the response `previewUrl`, the part from `#` on (e.g. `window.location.hash = '#/specs/foo/SPEC'`).** That drives the SPA router directly. Arm + `preview_start` only redirects a *fresh* open; it can't move an already-open pane (`preview_start` reuses the live process without reloading), so use `preview_eval` there. Don't read or edit `.claude/launch.json` — host-managed; the OK lock-collision proxy handles the UI-already-running case. If `preview_start` fails, report it; don't "fix" `launch.json`.
- **Cursor / Codex desktop — no `preview_*` tool, but you have an in-app / built-in browser tool** → call `preview_url` once for the **exact** target (`document` for a doc, `folder` for a folder) and navigate your **in-app browser** straight to the returned `url`. Open that deep URL directly — never the root then navigate; omit both args only for the root. Drive the tool your host gives you:
  - **Cursor** → its built-in **Browser** tool, the **`Navigate`** action (`browser_navigate`, via Cursor's own `cursor-ide-browser`). Navigate it to the `url` yourself — don't print the URL or shell out to the system browser. (A *surfaced* link in Cursor follows its "Browser Tab" vs "Google Chrome" picker and may open the system browser; you calling `Navigate` avoids that. A third-party MCP like OK cannot push a URL into the pane — only the agent's own `Navigate` can.)
  - **Codex desktop app** → its in-app **Browser** plugin (`@Browser`); drive it to the `url` (Codex navigates via `tab.goto`).
  - **Any other host** with a URL-navigation tool (`browser`, `view_url`, `open_url`, `web.browse`, …) → navigate it to the `url`. **This is also the fallback when a named tool above isn't present under that exact name** (hosts rename tools): match on the capability, not the name. If no URL-navigation tool exists at all, drop to the Claude Code CLI track below.
- **Honor `autoOpen`** (on `preview_url`, or on `warning` for write tools). If `false`, do not open or refresh any preview UI; surface the URL only if asked.

**Any CLI — a separate track (no browser).** **Claude Code CLI, Codex CLI, Cursor CLI, OpenCode, Pi — any pure-stdio / shell agent with no in-app browser tool — uses `ok open`, never a preview URL.** The rule is capability, not vendor: no tool that navigates a URL → you're on this track.

- **`ok open <name>`** — opens a **doc or folder** in the OK Desktop app. The type is auto-detected (a directory on disk → folder, otherwise a doc), so **`--folder` is not needed** (it stays only as an explicit override for a folder that doesn't exist on disk yet). An action you run, not a URL to print.
- **`ok open <skill-name> --skill [--scope project|global]`** — opens a **skill** in the skill editor (skills are addressed by name + scope, not a content path, so they need the flag).
- All three deep-link into OK Desktop when a bundle is installed, and fall back to the browser UI (`ok ui`) otherwise. No `ok` on PATH or no shell → `preview_url`, then `open <url>` in the system browser as a last resort, and say so plainly. The system browser is the fallback, never the default.

(The same vendors' *desktop apps* with a built-in browser — Cursor, Codex desktop — are NOT here; they navigate their own browser per the in-app branch above. Codex **IDE extension** / **Cloud** are web-search-only → they're on this CLI track too.) **Running inside the OK Desktop built-in terminal (the `OK_DESKTOP_TERMINAL` env var is set)? Same track — `ok open <name>` re-targets the window you're already in** (switches that window to the doc/folder; no second window, no need to raise it since it's already frontmost). Don't resolve preview URLs in that case; `ok open` is the whole answer.

**Opening or reading a file IS a preview navigation.** On any "open `<file>`" / "read `<file>`" request, navigate the browser to that doc's `previewUrl` route from the tool response — not a separate fetch, not a fresh system-browser launch.

**Four signals to check if the preview is already attached** (read these from each write response):

1. You opened/navigated earlier this session → don't reopen.
2. Write response has `previewUrl` (non-null route) and NO `warning` → a browser is attached somewhere; do nothing.
3. `warning: { action: "attach-preview-once", previewUrl, message }` → UI reachable, no browser attached; navigate one-shot (`preview_start`, or `preview_url` → in-app browser).
4. `warning: { action: "start-ui", previewUrl: null, message }` → no UI running anywhere. Surface the message verbatim — recovery options are in the in-band copy. Don't loop on retries.

Warnings fire at most once per session in the fresh-start case.

**Re-point at the end of a multi-doc workflow; don't claim a doc is on screen unless you put it there.** The one-shot attach (signal 3) opens the preview *once* — later writes do NOT move the pane; it stays on the doc you last navigated to. When a turn touches several docs, finish by navigating the preview to the doc the user should land on, using your host's move mechanism (`preview_eval` setting `window.location.hash` from the response `previewUrl`, or `preview_url` → in-app browser; honor `autoOpen`). Until you have navigated there *this* turn, don't tell the user a doc is "open" / "on screen" — at most, say the preview may still be on the doc you opened earlier.

**`previewUrl: null` only means "no UI reachable" on the two attach-warning tools: `write` / `edit`.** Workflow tools return prose and don't carry `previewUrl`. `delete` / `move` emit `previousPreviewUrl` (different field, for closing stale tabs) and don't fire attach warnings. `preview_url` auto-starts the backend on demand (same `OK_MCP_AUTOSTART` gate as writes; a cold first call can take seconds) and reports `running: false` + `url: null` only when no UI could be reached — its hint names the right command.

If you see `"Hocuspocus server is not running"`, run `ok start` and retry.

OK Electron and `ok ui` share `ui.lock`; when a second UI binds a different port, the OK lock-collision proxy bridges it to the live server transparently. That is exactly why `previewUrl` is route-only — the port behind the proxy is not the agent's to use. **Do not nudge the user to quit OK Electron to free a port** — the proxy handles it, and quitting tears down a UI in active use.

**The preview is read-only for the agent — it is the user's view, not a surface you read back.** You cannot click or type to drive edits — the CRDT flow is one-way (agent → MCP → CRDT → preview).

**No screenshots to confirm edits, no generic verification loop.** Do NOT take `preview_screenshot` (host tool, not OK MCP) after a write, and do not run a generic snapshot/eval/screenshot verification loop — OK's preview is a read-only, one-way mirror, so the CRDT tool response *is* the confirmation that an edit landed. Screenshot only when debugging a visual rendering issue or when the user explicitly asks to see the preview — never to confirm an edit landed. (Navigating the pane with `preview_eval` by setting `window.location.hash` is fine — that drives the view, it is not a read-back verification loop.)
