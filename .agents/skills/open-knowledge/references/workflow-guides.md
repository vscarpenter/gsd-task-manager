# Workflow tools — depth

(Core carries the dispatch table + "these are your default move". This file carries the operating detail.)

One MCP tool — `workflow` — builds on the read/write primitives, dispatched on `kind`. **It returns *procedural guidance* (a multi-step instructional body), not fetched data.** Calling `workflow({ kind: 'ingest', source: "https://…" })` does not download and write a doc for you — it returns a multi-step plan you then execute. Same for the `research` / `consolidate` / `discover` kinds. Plan to follow the numbered steps in order; don't skip the STOP gates.

Three kinds correspond to [Karpathy's three-layer knowledge-base pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) (`ingest` / `research` / `consolidate`); the fourth (`discover`) operates at the project-metadata layer and is the brownfield counterpart to the greenfield `ok seed` CLI.

Typical day-2 flow: user shares a URL → `ingest` (preserve) → user asks "now research this" → `research` (provisional article + `ingest`s more sources as needed) → decision lands → `consolidate` (canonical article, supersedes the research).

**Autonomy gates vs session-level autonomy.** Per-tool STOP gates (e.g. `research`'s scoping gate, `consolidate`'s decision-confirmation gate) are not overridden by session-level "work without stopping for clarifying questions" hints. The session-level hint covers trivial back-and-forth ("which file did you mean?"); per-tool gates exist for 1-way-door decisions where the tool deliberately wants confirmation before continuing. When in doubt, treat the per-tool gate as authoritative and the session-level autonomy hint as a default for the in-between turns.

**Do not chain silently.** After `ingest`, ask the user whether to proceed to `research`. After `research`, let the user decide whether the findings are ready to `consolidate`. Each tool completes on its own terms — the user drives the transitions.

**Repeat invocations.** The `workflow` tool returns its full instructional body on every call, including 2nd / 3rd / Nth invocation in the same session. If you've already received a tool's body earlier this session, you can skim the repeat for changes (the body can evolve across server versions) but you don't need to re-internalize it — proceed to the next step with the new arguments.

**Project scaffolding — two paths.** **Empty repo:** run `ok seed` once from a terminal (scaffolds the layout + seeds `log.md` + folder defaults). **Existing content:** invoke `workflow({ kind: 'discover' })`. Neither is required; the four workflow kinds work against any folder structure. Only mention each when explicitly relevant.

**Starter packs — reference for inspiration.** The `ok` CLI (a Bash surface beside the MCP tools; other verbs `ok start` / `ok open` are documented in the core) ships proven layouts you can study to build a *similar* structure of your own — adapt the idea, don't clone the pack:

- `knowledge-base` — source-grounded research articles
- `software-lifecycle` — proposals, decisions, specs
- `codebase-wiki` — agent-authored wiki of your codebase
- `plain-notes` — notes + daily journal
- `worldbuilding` — fiction story wiki
- `writing-pipeline` — drafts → published
- `entity-vault` — people / companies / meetings (personal CRM)
- `okf` — Open Knowledge Format–conformant base

To reference one **without installing it**: `ok seed --list-packs` (the menu) → `ok seed --pack <name> --dry-run` (its folders + the *why* of each folder + templates; writes nothing). Then either adapt the ideas into your own folders (`write({ folder })` + a template) or adopt the pack as-is by re-running without `--dry-run`. Reach for this when a user wants structure and an archetype fits — propose a tailored variant, not a verbatim copy.
