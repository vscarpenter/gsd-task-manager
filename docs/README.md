# docs

## Overview

This directory holds the project's documents. It has no source files of its own. Two child directories hold source code next to their documents: diagram generators and formal models. This file lists only those two. `docs/css` holds four stylesheets and has no README.

## Subdirectories & Boundaries

- diagrams: [./diagrams/README.md](./diagrams/README.md) - Generator scripts for the architecture diagram and the reminder statechart, plus three TLA+ modules in two model directories. The scripts overwrite HTML and PNG files in `docs/diagrams/`.
- formal: [./formal/README.md](./formal/README.md) - Three TLA+ models of sync and task storage. Each has a `check.sh` that runs its configs through `scripts/tlc.sh`.
