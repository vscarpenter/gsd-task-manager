# Conflict-aware writes

Projects with GitHub sync enabled may carry docs in a merge-conflict state. The MCP server refuses every mutating call against such a doc with a structured RFC 9457 response:

```json
{
  "type": "urn:ok:error:doc-in-conflict",
  "title": "Document is in conflict.",
  "status": 409,
  "detail": "The document is in a merge-conflict state. Call conflicts({ kind: 'content' }) + resolve_conflict before retrying.",
  "file": "notes/sso.md",
  "resolutionOptions": ["mine", "theirs", "content", "delete"]
}
```

The gate covers `write`, `edit`, `delete`, `move`, `restore_version`, and agent undo (the doc-CRDT write spine; template/folder ops are fs-direct). You cannot route around it by writing content that byte-matches one of the merge stages — the gate refuses on lifecycle state, not on body equality.

**Detect proactively.** `exec("cat <path>.md")` always returns `lifecycle: {status, reason} | null` alongside the body. When `status === 'conflict'`, switch to the resolution flow before attempting any mutation.

**Resolution flow.** Three tools compose:

1. `conflicts({ kind: 'list' })` → enumerate every doc currently tracked in conflict.
2. `conflicts({ kind: 'content', file })` → returns `{ content: { base, ours, theirs, shape, lifecycleStatus } }` (the result nests under the `content` kind key). `ours` reflects the live Y.Text (what the human user sees in the editor) when the doc is loaded server-side and is marker-free; falls back to `git show :2:<file>` otherwise (e.g. after an editor reopen seeded markers into Y.Text).
3. `resolve_conflict({ file, strategy, content? })` → write the chosen bytes and commit. Strategies: `mine` runs `git checkout --ours` (your committed stage 2), `theirs` runs `git checkout --theirs` (their stage 3), `content` writes the bytes you supply, `delete` runs `git rm` (for delete-modify / modify-delete shapes where a stage is missing).

`file` is a `.md` / `.mdx` path relative to the project dir (extension included) — mirrors the on-disk shape, not the extension-less `document` path used by other tools.

The resolve operation is best-effort and NOT atomic: `git checkout --ours/--theirs && git add` may succeed but the subsequent `git commit --no-edit` can fail (pre-commit hook rejection, locked index). On commit failure the staged files are re-`git add`-ed back into the unmerged index and the tracked entry remains in `conflicts.json` — re-call `resolve_conflict` after the user clears the blocker.
