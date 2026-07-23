# Setting up OpenKnowledge

This repository is an OpenKnowledge (OK) project: its `.md` / `.mdx` files are CRDT documents, and agents work with them through the OpenKnowledge MCP server. If your agent's `mcp__open-knowledge__*` tools aren't available, the project just isn't connected on this machine yet. Connect it at whatever depth you need — each rung adds capability, and you can stop at the first one that covers your task.

**Canonical, always-current instructions:** <https://openknowledge.ai/docs/get-started/quickstart>. The rungs below are a quick orientation; the docs are authoritative (release channels and download links move, so this file deliberately points there rather than pinning them).

## Rung 1 — Agent tooling, no install

Approve the committed `.mcp.json` in your agent client (Claude Code, Cursor, Codex, …). It launches the OK MCP server on demand via `npx`, so there is nothing to install. This gives you the read tools (`exec`, `search`) over the docs plus the fs-direct write tools (`write` / `edit` for markdown and skills).

This rung does **not** start a collaboration server, so it does not give you live CRDT co-editing or the browser preview — those need rung 2.

## Rung 2 — Full editing + live preview, via the CLI

Install the OK CLI and start a local server:

```bash
npm install -g @inkeep/open-knowledge   # or run it ad hoc with: npx @inkeep/open-knowledge
ok start
```

`ok start` runs the collaboration server and serves a browser preview at the URL it prints — no GUI required. Markdown writes now land in the live CRDT and the preview updates as you (or an agent) edit.

## Rung 3 — Desktop app, optional

For a native editor with the file tree, property panel, and built-in preview, install the OK Desktop app. The quickstart link above has the current download — it tracks the latest release, so grab it there rather than from a pinned URL.
