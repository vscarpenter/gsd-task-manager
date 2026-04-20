#!/bin/bash
#
# Fix Content-Type metadata on agent-discovery files in S3.
#
# Next.js static export ships these files unchanged from `public/`, but S3
# infers Content-Type from the extension. Some discovery files have no
# extension (e.g. `/.well-known/api-catalog`) or need a non-default media
# type (e.g. `application/linkset+json`, `application/openapi+json`,
# `text/markdown`). This script copies them in place with the correct
# Content-Type so agents and validators see the canonical type.
#
# Usage: scripts/fix-discovery-content-types.sh s3://bucket-name

set -e

BUCKET="${1:?Usage: $0 s3://bucket-name}"

# Helper that runs `aws s3 cp <key> <key>` with a content-type override.
fix_type() {
  local key="$1"
  local ctype="$2"
  local cache="${3:-public,max-age=300,must-revalidate}"
  echo "  → $key  ($ctype)"
  aws s3 cp "$BUCKET/$key" "$BUCKET/$key" \
    --metadata-directive REPLACE \
    --content-type "$ctype" \
    --cache-control "$cache" \
    >/dev/null
}

echo "Fixing Content-Type on discovery files in $BUCKET ..."

# RFC 9727 — application/linkset+json (no file extension on disk).
fix_type ".well-known/api-catalog" "application/linkset+json"

# RFC 9728 — Protected Resource Metadata.
fix_type ".well-known/oauth-protected-resource" "application/json"

# OpenAPI 3.1 description for the sync backend.
fix_type ".well-known/openapi/pocketbase.json" "application/openapi+json"

# MCP Server Card and Agent Skills index — registered as application/json.
fix_type ".well-known/mcp/server-card.json" "application/json"
fix_type ".well-known/agent-skills/index.json" "application/json"

# SKILL.md files served as markdown for agent consumption.
for skill in quick-capture triage-inbox; do
  fix_type ".well-known/agent-skills/$skill/SKILL.md" "text/markdown; charset=utf-8"
done

# Markdown renditions of HTML pages (consumed via Accept: text/markdown).
for md in index.md about/index.md; do
  fix_type "$md" "text/markdown; charset=utf-8" "public,max-age=0,must-revalidate"
done

echo "Done."
