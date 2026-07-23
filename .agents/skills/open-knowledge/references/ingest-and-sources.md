# Binary-source wrappers (`ingest`-produced)

Docs that wrap a co-located binary file under `external-sources/` carry extra frontmatter so the wrapper-binary pair is fully described:

```yaml
---
title: ...
description: ...
source_url: https://example.com/file.pdf
source_path: ./<slug>.<ext>      # relative to this wrapper
media_type: application/pdf
bytes: 1234567
sha256: <64-char hex>            # of the embedded binary
date_fetched: YYYY-MM-DD
preservation: binary             # OR: text-only / text-extracted
supersedes:                      # OPTIONAL — dated-sibling re-ingest
  - <prior-slug>.md
tags: [source, immutable, layer-ingest, binary]
---

![[<slug>.<ext>]]
```

Body is just the wiki-embed. PDFs/opaque attachments render as a click-dispatching File row; `<Pdf src="./<slug>.pdf" />` is the opt-in inline viewer. See `ingest`'s tool body for full re-ingest / size / executable rules.
