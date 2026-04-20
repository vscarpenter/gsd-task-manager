# 0010: Agent Discovery Surface

**Date:** 2026-04-20
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

External agent-readiness scanners (e.g. `isitagentready.com`) flagged that
`https://gsd.vinny.dev` exposes no machine-readable affordances for AI
agents: no `Link` headers (RFC 8288), no `application/linkset+json` API
catalog (RFC 9727), no OAuth Protected Resource Metadata (RFC 9728), no MCP
Server Card, no Agent Skills index, no `Content-Signal` directives in
`robots.txt`, and no `Accept: text/markdown` content negotiation.

GSD already ships an MCP server (`gsd-mcp-server` on npm) and a PocketBase
backend at `https://api.vinny.io`. The existing infrastructure can be made
discoverable cheaply if we expose the right metadata files and response
headers. Doing so unlocks two practical wins:

1. Agents that crawl with `HEAD /` see one `Link` header and can fetch every
   discovery document without further guessing.
2. In-page agents (browser extensions implementing WebMCP) can call the
   site's `create_task` tool directly, without scraping the DOM.

Because the site is a Next.js static export served from S3 + CloudFront, the
implementation has constraints: no Next.js middleware, no API routes, no
runtime content negotiation. All discovery resources must be static files in
`public/`, and HTTP-level concerns (response headers, content negotiation)
must be handled at the CDN edge.

## Decision

Expose the following surface, all of it cacheable, all of it static:

### Static files (under `public/`)

| Path | Type | Purpose |
| --- | --- | --- |
| `/.well-known/api-catalog` | `application/linkset+json` | RFC 9727 linkset that anchors the PocketBase API and the MCP server |
| `/.well-known/openapi/pocketbase.json` | `application/openapi+json` | OpenAPI 3.1 description of the GSD-specific PocketBase endpoints |
| `/.well-known/oauth-protected-resource` | `application/json` | RFC 9728 metadata pointing to PocketBase as the authorization server |
| `/.well-known/mcp/server-card.json` | `application/json` | SEP-1649-style server card for `gsd-mcp-server` |
| `/.well-known/agent-skills/index.json` | `application/json` | Agent Skills Discovery v0.2.0 index |
| `/.well-known/agent-skills/{slug}/SKILL.md` | `text/markdown` | Individual skill documents (`quick-capture`, `triage-inbox`) with SHA-256 digests in the index |
| `/index.md`, `/about/index.md` | `text/markdown` | Markdown renditions of the homepage and About page for `Accept: text/markdown` clients |
| `/robots.txt` | `text/plain` | Adds `Content-Signal: search=yes, ai-input=yes, ai-train=no` per the AI Preferences draft |

### CloudFront edge functions

- `gsd-url-rewrite` (viewer-request) gains a second responsibility:
  when the request includes `Accept: text/markdown`, rewrite the URI from
  `…/index.html` to `…/index.md` so S3 returns the markdown rendition.
- `gsd-response-headers` is a new viewer-response function that emits an
  RFC 8288 `Link` header on every HTML and markdown response, advertises
  `Vary: Accept`, and forces `Content-Type: text/markdown; charset=utf-8` on
  `.md` documents (S3 sometimes serves them as `binary/octet-stream`).

Both source files use the `.cjs` extension and end with a guarded
`module.exports = { handler }` so the Node test runner can `require()` them
without dynamic code evaluation. The guard is dead code at the edge —
CloudFront's JS runtime executes the file as a script with no `module`
global. Extension does not affect the AWS upload (`fileb://` reads bytes).

### In-browser tooling

- `components/webmcp-register.tsx` calls
  `navigator.modelContext.provideContext()` on mount when the WebMCP API is
  available, exposing a single `create_task` tool that writes to the
  user's local IndexedDB through the existing `lib/tasks/createTask` path.

### Deploy automation

- `scripts/fix-discovery-content-types.sh` patches Content-Type metadata on
  the well-known files after `aws s3 sync` (S3 cannot infer the right type
  for `application/linkset+json`, the no-extension `api-catalog` file, or
  `application/openapi+json`).
- `scripts/deploy-cloudfront-function.sh` now publishes both edge functions
  and attaches them to the distribution (viewer-request + viewer-response).

## Consequences

### Easier
- A single `HEAD /` reveals the entire programmatic surface to any compliant
  agent crawler.
- WebMCP-aware browser agents can create tasks without scraping the UI.
- Markdown renditions reduce token cost when LLMs ingest the homepage.
- The `Content-Signal` directives publish an explicit AI-training stance
  alongside the existing `robots.txt` entries.

### Harder
- Two CloudFront Functions instead of one, both of which must be re-published
  when their source changes. The deploy script handles this in one command,
  but engineers need to know the second function exists.
- Markdown renditions must be hand-maintained until we either generate them
  from the React tree or accept that they only describe the static landing
  surfaces (homepage + About).
- `Vary: Accept` makes shared caches store two representations per route,
  doubling cache footprint for the homepage and About page.

### Out of scope
- A site-wide markdown rendition for every authenticated route (the matrix,
  dashboard, and settings pages are interactive React state and have no
  meaningful static markdown).
- Publishing `/.well-known/openid-configuration` here. PocketBase owns the
  authorization server; that document belongs on `api.vinny.io`, not on the
  resource server.
- Server-side WebMCP fallback for browsers without `navigator.modelContext`.
  The MCP server (`gsd-mcp-server`) covers that case via stdio.

## Alternatives Considered

- **Cloudflare's "Markdown for Agents" feature** — automatically produces
  markdown from HTML at the edge, but only on Cloudflare's CDN. We use
  CloudFront, so we ship pre-rendered markdown instead.
- **A single CloudFront viewer-request function that rewrites and adds
  response headers via Lambda@Edge** — more powerful but adds cold-start
  latency and a second deployment surface. Two CloudFront Functions are
  cheaper and simpler.
- **Embedding the `Link` header source list in JS at runtime** — would not
  be visible to crawlers that only inspect HTTP headers, defeating the
  purpose of RFC 8288.
