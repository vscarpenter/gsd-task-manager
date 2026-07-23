# Cadence + log discipline

## Cadence

When you make a multi-step change (batch of new docs, folder restructure), pause between steps to let the browser preview catch up. The CRDT edit streams live; the preview follows your edit cadence. Don't batch 10 writes in a row — interleave the writes so the user watching the browser sees the narrative progress.

This does not conflict with *Persist incrementally* (§Writing): a checkpoint-write per section/source is naturally spaced by the work that produces that unit (read a source → write its findings → read the next), so those writes *are* the interleaved cadence. The anti-pattern is firing many writes back-to-back with no intervening work — not persisting completed work as you go. When in tension, durability wins: never hold finished work back from the KB to smooth cadence.

This is primarily a human-watchability concern — the user watches edits land in the preview; interleaved cadence makes the narrative legible. When the batch is done, navigate the preview to the primary deliverable (see "End a turn on the deliverable" in `references/preview.md`).

**Hub docs.** Don't *create* `INDEX.md` / `README.md` hub files solely to catalog children — `exec("ls -A <folder>")` returns the same view live, with per-file frontmatter + backlink counts. But if a hub doc *already exists* from prior work, keep it updated as children change — interleave: write child → update hub → write next child, rather than batching five child edits and a single trailing hub update.

## Log discipline — check for a project log when KB content changes

Some projects keep an append-only project log to make agent activity auditable. **After any turn that creates, edits, or restructures docs in the knowledge base, check for a project log:** look for a `log.md` at the project root (or at the seed `rootDir` if `ok seed --root <dir>` was used). If one exists, follow whatever its frontmatter `description:` and in-file comment say — they carry the project-specific contract (entry shape, cadence, categories). Different projects log differently — some treat the log as a wiki audit trail, others as an LLM-brain history, others as a spec changelog. If no `log.md` exists, no log discipline applies; don't fabricate one.

The skill carries the trigger ("KB content changed this turn — go look"). The file owns the policy.
