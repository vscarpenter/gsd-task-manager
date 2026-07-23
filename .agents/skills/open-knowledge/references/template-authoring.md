# Template authoring + folder editing

## When to create a template

Templates make folder structure durable. Create them proactively:

- 2+ sibling docs share a skeleton in a folder with no template → extract via `write({ template })`.
- About to write a doc in a folder where no template fits, AND the shape is reusable → save as template the same turn.
- Scaffolding a new folder for a doc category → pair `write({ folder })` (or `edit({ folder })`) with `write({ template })` in the same turn.
- The user describes a recurring doc shape ("we always log meetings with attendees, agenda, action items") → author the template once.

Note new templates in chat ("saved as a template at `meetings/.ok/templates/prep-notes.md` for next time") so the user sees the discipline grew.

**Keep starter content clean (MUST).** A template body is a reusable skeleton, not a meta-prompt: section headings, real frontmatter, and SHORT `{Stub}` placeholders (e.g. `# {Meeting Title}`). Do NOT bake a workflow's verbose `{...}` prompt-paragraphs (the `research` / `consolidate` shape guidance is for filling ONE doc, not for persisting into every new one), do NOT duplicate sections, and do NOT save a half-filled or in-progress doc as a template. Long "how to fill this" guidance belongs in the folder description, not in the body each new doc inherits. After saving, `exec("cat <folder>/.ok/templates/<name>.md")` and eyeball it — a template propagates to every doc made from it, so a garbled one is a recurring defect, not a one-off.

## Editing a folder's own description

```ts
edit({
  folder: {
    path: "meetings",
    frontmatter: { title: "Meetings", description: "Meeting notes", tags: ["meeting"] },
  },
})
```

`frontmatter` is open-shape — any key about the folder itself, exactly like a doc's frontmatter (`title` / `description` / `tags` are conventional keys the UI surfaces). It's self-only: it describes the folder and does NOT flow into child docs — put per-doc starting values in a template instead. Each call targets a SINGLE folder by its own `path` (no globs). Use `write({ folder })` to create a new folder, `edit({ folder })` to change an existing one (merge-patch). Clear the folder's frontmatter by passing `frontmatter: {}`, or drop one key with `frontmatter: { key: null }` — the file deletes when empty and `.ok/` auto-cleans if no other tenant remains.

## Creating templates

```ts
write({
  template: {
    path: "meetings/prep-notes",
    content: "# {Meeting Title}\n\n**Attendees:** \n**Date:** \n\n## Agenda\n- \n",
    frontmatter: {
      title: "Meeting Prep Notes",          // REQUIRED — TEMPLATE_TITLE_REQUIRED if missing
      description: "Use before a meeting.", // recommended — soft warning if absent
      tags: ["meeting", "prep"],
    },
  },
})
```

**Substitution allowlist:** template bodies MAY use exactly two server-side substitutions — `{{date}}` (today's ISO-8601 date) and `{{user}}` (calling principal display name). Other `{{...}}` tokens are rejected at write time with `TEMPLATE_UNKNOWN_VARIABLE`. Plain `{shape}` placeholders (e.g., `{Meeting Title}`) are LITERAL — agents fill via subsequent `edit` calls. Delete a template via `delete({ template: { path } })` (auto-cleans empty `.ok/templates/` and `.ok/`).

## Creating a doc from a template

```ts
// Inspect the menu (already done in the pre-write checklist).
exec("ls -A meetings/")
// → templates_available: [{ name: "prep-notes", title: "Meeting Prep Notes", scope: "local" }, ...]

// Instantiate. `template` and `content` are mutually exclusive.
write({
  document: {
    path: "meetings/2026-05-02-roadmap-sync",
    template: "prep-notes",
  },
})

// Fill the `{shape}` placeholders via follow-up edit calls.
```

Templates resolve via leaf → root walk-up at the target's parent folder, closest-wins on filename collision. **`template` and `content` are mutually exclusive** — passing both errors with `TEMPLATE_AND_CONTENT_BOTH_SET`. Substitution happens at instantiation time only; templates on disk show the raw `{{date}}` token.
